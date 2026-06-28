import { useEffect, useState } from 'react';
import type { OriginalWord, VerseWithWords } from '../types';
import { getVerseTranslation } from '@verse-roots/bible-client';
import { fetchNivVerse, isApiBibleConfigured } from '../utils/apiBible';
import { WordChip } from './WordChip';
import { AddMemoryButton } from './AddMemoryButton';
import { formatRef } from '../utils';
import './VerseDisplay.css';

interface VerseDisplayProps {
  verse: VerseWithWords;
  selectedWordId: number | null;
  onWordClick: (word: OriginalWord) => void;
  translation: string;
  onTranslationChange: (t: string) => void;
  onAddToMemory?: (ref: string, scope: 'verse' | 'chapter', display: string) => Promise<'added' | 'exists'>;
}

// Translations stored in Supabase (always available)
const SUPABASE_TRANSLATIONS = ['KJV', 'ASV', 'WEB'];

// NIV is fetched from API.Bible when an API key is configured
const NIV_AVAILABLE = isApiBibleConfigured;

const TRANSLATION_ATTRIBUTION: Record<string, string> = {
  KJV: 'KJV (public domain)',
  ASV: 'ASV (public domain)',
  WEB: 'WEB (public domain)',
  NIV: 'NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®',
};

function buildExternalUrl(site: 'ESV' | 'NET', ref: string): string {
  const display = formatRef(ref);
  const encoded = encodeURIComponent(display);
  switch (site) {
    case 'ESV':
      return `https://www.esv.org/${encoded}/`;
    case 'NET':
      return `https://netbible.org/bible/${encoded}`;
  }
}

function buildNivUrl(ref: string): string {
  const display = formatRef(ref);
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(display)}&version=NIV`;
}

export function VerseDisplay({
  verse,
  selectedWordId,
  onWordClick,
  translation,
  onTranslationChange,
  onAddToMemory,
}: VerseDisplayProps) {
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [transLoading, setTransLoading] = useState(false);

  useEffect(() => {
    setTranslationText(null);
    setTransLoading(true);

    const load = async () => {
      try {
        if (translation === 'NIV') {
          const text = await fetchNivVerse(verse.ref);
          setTranslationText(text);
        } else {
          const data = await getVerseTranslation(verse.ref, translation);
          setTranslationText(data?.text ?? null);
        }
      } catch {
        setTranslationText(null);
      } finally {
        setTransLoading(false);
      }
    };

    void load();
  }, [verse.ref, translation]);

  return (
    <section className="verse-display">
      <div className="verse-display__topline">
        <h2 className="verse-ref">{formatRef(verse.ref)}</h2>
        {onAddToMemory && (
          <AddMemoryButton
            label="Add to Memory"
            onAdd={() => onAddToMemory(verse.ref, 'verse', formatRef(verse.ref))}
          />
        )}
      </div>

      <div className="translation-bar">
        <span className="translation-label">Translation:</span>
        <div className="translation-pills" role="group" aria-label="Translation">
          {NIV_AVAILABLE && (
            <button
              className={`translation-pill${translation === 'NIV' ? ' translation-pill--active' : ''}`}
              onClick={() => onTranslationChange('NIV')}
            >
              NIV
            </button>
          )}
          {SUPABASE_TRANSLATIONS.map((t) => (
            <button
              key={t}
              className={`translation-pill${translation === t ? ' translation-pill--active' : ''}`}
              onClick={() => onTranslationChange(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <span className="translation-external-links">
          {(['ESV', 'NET'] as const).map((site) => (
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
          {!NIV_AVAILABLE && (
            <a
              href={buildNivUrl(verse.ref)}
              target="_blank"
              rel="noopener noreferrer"
              className="translation-ext-link"
            >
              NIV ↗
            </a>
          )}
        </span>
      </div>

      {translationText && !transLoading && (
        <blockquote className="translation-text">
          {translationText}
          <footer className="translation-attribution">
            — {TRANSLATION_ATTRIBUTION[translation] ?? translation}
          </footer>
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
