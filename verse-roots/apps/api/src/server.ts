import express from 'express';
import cors from 'cors';
import {
  getVerse,
  getStrongs,
  getConcordance,
  getChapter,
} from '@verse-roots/db';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

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
  const results = getConcordance(id).slice(0, 50);
  res.json(results);
});

app.get('/api/chapter/:ref', (req, res) => {
  const { ref } = req.params;
  const chapter = getChapter(ref);
  res.json(chapter);
});

app.listen(PORT, () => {
  console.log(`Verse Roots API running on http://localhost:${PORT}`);
});
