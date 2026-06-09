import { useState } from 'react';
import type { User, SubscriptionStatus } from '../../lib/supabase';
import './AccountPage.css';

interface AccountPageProps {
  user: User;
  subscriptionStatus: SubscriptionStatus;
  onClose: () => void;
  onSubscriptionUpdated: () => void;
}

export function AccountPage({
  user,
  subscriptionStatus,
  onClose,
  onSubscriptionUpdated,
}: AccountPageProps) {
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpgrade = async () => {
    if (!user.email) return;
    setUpgradeLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to start checkout.');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleManagePortal = async () => {
    setPortalLoading(true);
    setError('');
    // We don't expose customer ID to the frontend — hit a backend endpoint
    // that looks it up by userId.
    try {
      const res = await fetch('/api/stripe/portal-by-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to open billing portal.');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPortalLoading(false);
    }
  };

  const { plan, currentPeriodEnd, canSync } = subscriptionStatus;

  const planLabel =
    plan === 'active'
      ? 'Pro'
      : plan === 'canceled'
        ? 'Canceled'
        : plan === 'past_due'
          ? 'Past Due'
          : 'Free';

  return (
    <div className="account-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Account">
      <div className="account-page" onClick={(e) => e.stopPropagation()}>
        <div className="account-page__header">
          <h2 className="account-page__title">Account</h2>
          <button className="account-page__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <section className="account-section">
          <div className="account-section__label">Signed in as</div>
          <div className="account-section__value">{user.email}</div>
        </section>

        <section className="account-section">
          <div className="account-section__label">Plan</div>
          <div className="account-section__value account-section__value--plan">
            <span
              className={`account-plan-badge account-plan-badge--${plan}`}
            >
              {planLabel}
            </span>
            {currentPeriodEnd && (
              <span className="account-section__period">
                Renews {currentPeriodEnd.toLocaleDateString()}
              </span>
            )}
          </div>
        </section>

        {error && <p className="account-error">{error}</p>}

        <div className="account-actions">
          {!canSync && (
            <button
              className="account-btn account-btn--primary"
              onClick={handleUpgrade}
              disabled={upgradeLoading}
            >
              {upgradeLoading ? 'Redirecting…' : 'Upgrade to Pro — $7/mo'}
            </button>
          )}
          {canSync && (
            <button
              className="account-btn account-btn--secondary"
              onClick={handleManagePortal}
              disabled={portalLoading}
            >
              {portalLoading ? 'Loading…' : 'Manage subscription'}
            </button>
          )}
        </div>

        <p className="account-fine-print">
          Pro plan includes cloud sync across all your devices. Your local studies are
          always saved for free.
          {canSync && (
            <>
              {' '}
              <button className="account-link" onClick={onSubscriptionUpdated}>
                Refresh status
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
