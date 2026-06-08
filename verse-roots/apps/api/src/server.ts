import express from 'express';
import cors from 'cors';
import {
  getVerse,
  getStrongs,
  getConcordance,
  getChapter,
  getVerseTranslation,
} from '@verse-roots/db';
import { stripeRouter } from './stripe.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));

// Stripe webhook requires raw body for signature verification — mount BEFORE express.json()
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Stripe routes (checkout session + billing portal live under /api/stripe)
app.use('/api/stripe', stripeRouter);

app.get('/api/verse/:ref', (req, res) => {
  const { ref } = req.params;
  const verse = getVerse(ref);
  if (!verse) {
    res.status(404).json({ error: `Verse not found: ${ref}` });
    return;
  }
  res.json(verse);
});

app.get('/api/strongs/:id', (req, res) => {
  const { id } = req.params;
  const entry = getStrongs(id);
  if (!entry) {
    res.status(404).json({ error: `Strong's entry not found: ${id}` });
    return;
  }
  res.json(entry);
});

app.get('/api/concordance/:id', (req, res) => {
  const { id } = req.params;
  const limitParam = parseInt(String(req.query.limit ?? '50'), 10);
  const limit = isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200);
  const offsetParam = parseInt(String(req.query.offset ?? '0'), 10);
  const offset = isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);
  const book = typeof req.query.book === 'string' ? req.query.book : null;

  let all = getConcordance(id);
  if (book) {
    all = all.filter((e) => e.book === book);
  }
  const total = all.length;
  const results = all.slice(offset, offset + limit);
  res.json({ total, results });
});

app.get('/api/verse/:ref/translation/:translation', (req, res) => {
  const { ref, translation } = req.params;
  const result = getVerseTranslation(ref, translation.toUpperCase());
  if (!result) {
    res.status(404).json({ error: `Translation not found: ${ref} (${translation})` });
    return;
  }
  res.json(result);
});

app.get('/api/chapter/:ref', (req, res) => {
  const { ref } = req.params;
  const chapter = getChapter(ref);
  res.json(chapter);
});

app.listen(PORT, () => {
  console.log(`Verse Roots API running on http://localhost:${PORT}`);
});
