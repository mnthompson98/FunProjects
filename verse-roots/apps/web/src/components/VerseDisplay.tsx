import { useEffect, useState } from 'react';
import type { OriginalWord, VerseWithWords } from '../types';
import { getVerseTranslation } from '@verse-roots/bible-client';
import { WordChip } from './WordChip';
import { formatRef } from '../utils';
import './VerseDisplay.css';

interface VerseDisplayProps {
  verse: VerseWithWords;
  selectedWordId: number | null;
  onWordClick: (word: OriginalWord) => void;
  translation: string;
  onTranslationChange: (t: string) => void;
}

const AVAILABLE_TRANSLATIONS = ['KJV'];
const FUTURE_TRANSLATIONS = ['ASV', 'WEB'];

function buildExternalUrl(site: 'ESV' | 'NIV' | 'NET', ref: string): string {
  const display = formatRef(ref); // e.g. "Lamentations 3:22"
  const [bookName, chapterVerse] = display.split(' ').reduce<[string, string]>(
    (acc, part) => {
      if (/^\d+:\d+$/.test(part)) return [acc[0], part];
      return [acc[0] ? acc[0] + ' ' + part : part, acc[1]];
    },
    ['', '']
  );
  const encoded = encodeURIComponent(`${bookName} ${chapterVerse}`);
  switch (site) {
    case 'ESV':
      return `https://www.esv.org/${encoded}/`;
    case 'NIV':
      return `https://www.biblegateway.com/passage/?search=${encoded}&version=NIV`;
    case 'NET':
      return `https://netbible.org/bible/${encoded}`;
  }
}

export function VerseDisplay({
  verse,
  selectedWordId,
  onWordClick,
  translation,
  onTranslationChange,
}: VerseDisplayProps) {
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [transLoading, setTransLoading] = useState(false);

  useEffect(() => {
    setTranslationText(null);
    setTransLoading(true);
    getVerseTranslation(verse.ref, translation)
      .then((data) => setTranslationText(data?.text ?? null))
      .catch(() => setTranslationText(null))
      .finally(() => setTransLoading(false));
  }, [verse.ref, translation]);

  return (
    <section className="verse-display">
      <h2 className="verse-ref">{formatRef(verse.ref)}</h2>

      <div className="translation-bar">
        <span className="translation-label">Translation:</span>
        <select
          className="translation-select"
          value={translation}
          onChange={(e) => onTranslationChange(e.target.value)}
        >
          {AVAILABLE_TRANSLATIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
          {FUTURE_TRANSLATIONS.map((t) => (
            <option key={t} value={t} disabled>{t} (coming soon)</option>
          ))}
        </select>

        <span className="translation-external-links">
          {(['ESV', 'NIV', 'NET'] as const).map((site) => (
            <a
              key={site}
              href={buildExternalUrl(site, verse.ref)}
              target="_blank"
              rel="noopener noreferrer"
              className="translation-ext-link"
            >
              {site} ↗
            </a>
          ))}
        </span>
      </div>

      {translationText && !transLoading && (
        <blockquote className="translation-text">
          {translationText}
          <footer className="translation-attribution">— KJV (public domain)</footer>
        </blockquote>
      )}

      <div className="verse-words">
        {verse.words.map((word) => (
          <WordChip
            key={word.id}
            word={word}
            selected={word.id === selectedWordId}
            onClick={onWordClick}
          />
        ))}
      </div>
    </section>
  );
}
