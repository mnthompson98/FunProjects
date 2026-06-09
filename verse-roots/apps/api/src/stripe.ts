import Stripe from 'stripe';
import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// Stripe price ID for the $7/mo subscription (set STRIPE_PRICE_ID in env,
// or the create-checkout-session endpoint uses inline price_data as fallback).
const stripePriceId = process.env.STRIPE_PRICE_ID ?? '';

// Supabase admin client (uses service role key — never expose this to the frontend)
const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Only create the Stripe client when a key is present so the server starts
// cleanly without env vars.
function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const stripeRouter: Router = createRouter();

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook
// Must be mounted BEFORE express.json() with express.raw() middleware applied
// at the route level (or globally for this path).
// ---------------------------------------------------------------------------
stripeRouter.post(
  '/webhook',
  // express.raw() must be applied before this handler — see server.ts mount note
  async (req: Request, res: Response) => {
    if (!stripeSecretKey || !stripeWebhookSecret) {
      res.status(503).json({ error: 'Stripe is not configured.' });
      return;
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header.' });
      return;
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, stripeWebhookSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: `Webhook signature verification failed: ${msg}` });
      return;
    }

    if (!supabaseAdmin) {
      // Ack the event so Stripe doesn't retry, but log the problem
      console.warn('[stripe webhook] Supabase admin client not configured — event dropped:', event.type);
      res.json({ received: true });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id;
          if (userId && customerId) {
            await supabaseAdmin
              .from('subscriptions')
              .upsert(
                {
                  user_id: userId,
                  stripe_customer_id: customerId,
                  status: 'free', // will be updated by subscription.created event
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' },
              );
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          const periodEnd = sub.items.data[0]?.plan?.interval
            ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()
            : null;

          await supabaseAdmin
            .from('subscriptions')
            .upsert(
              {
                stripe_customer_id: customerId,
                stripe_subscription_id: sub.id,
                status: sub.status,
                current_period_end: periodEnd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'stripe_customer_id' },
            );
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const customerId =
            typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'canceled', updated_at: new Date().toISOString() })
            .eq('stripe_customer_id', customerId);
          break;
        }

        default:
          // Unhandled event type — ignore
          break;
      }
    } catch (err) {
      console.error('[stripe webhook] Handler error:', err);
      // Still return 200 so Stripe doesn't endlessly retry
    }

    res.json({ received: true });
  },
);

// ---------------------------------------------------------------------------
// POST /api/stripe/create-checkout-session
// Body: { userId: string, email: string }
// ---------------------------------------------------------------------------
stripeRouter.post('/create-checkout-session', async (req: Request, res: Response) => {
  if (!stripeSecretKey) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }

  const { userId, email } = req.body as { userId?: string; email?: string };
  if (!userId || !email) {
    res.status(400).json({ error: 'userId and email are required.' });
    return;
  }

  try {
    const stripe = getStripe();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = stripePriceId
      ? [{ price: stripePriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 700,
              recurring: { interval: 'month' },
              product_data: { name: 'Verse Roots Pro' },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: lineItems,
      customer_email: email,
      success_url: `${frontendUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/account`,
      metadata: { userId },
    });

    res.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/portal
// Body: { customerId: string }
// ---------------------------------------------------------------------------
stripeRouter.post('/portal', async (req: Request, res: Response) => {
  if (!stripeSecretKey) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }

  const { customerId } = req.body as { customerId?: string };
  if (!customerId) {
    res.status(400).json({ error: 'customerId is required.' });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/portal-by-user
// Body: { userId: string }
// Looks up the Stripe customer ID from Supabase and opens the billing portal.
// ---------------------------------------------------------------------------
stripeRouter.post('/portal-by-user', async (req: Request, res: Response) => {
  if (!stripeSecretKey) {
    res.status(503).json({ error: 'Stripe is not configured.' });
    return;
  }
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase admin client is not configured.' });
    return;
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'userId is required.' });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data?.stripe_customer_id) {
    res.status(404).json({ error: 'No subscription found for this user.' });
    return;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id as string,
      return_url: `${frontendUrl}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
