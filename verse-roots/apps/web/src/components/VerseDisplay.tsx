import { useEffect, useState } from 'react';
import type { OriginalWord, VerseWithWords } from '../types';
import { getVerseTranslation } from '@verse-roots/bible-client';
import { fetchNivVerse } from '../utils/apiBible';
import { WordChip } from './WordChip';
import { AddMemoryButton } from './AddMemoryButton';
import { TranslationBar } from './TranslationBar';
import { NIV_AVAILABLE, TRANSLATION_ATTRIBUTION } from '../utils/translations';
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

      <TranslationBar value={translation} onChange={onTranslationChange}>
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
      </TranslationBar>

      {translationText && !transLoading && (
        <blockquote className="translation-text">
          {translationText}
          <footer className="translation-attribution">
            — {TRANSLATION_ATTRIBUTION[translation] ?? translation}
          </footer>
        </blockquote>
      )}
      {!translationText && !transLoading && (
        <p className="translation-unavailable">
          {translation} text isn’t available for this verse. Try another translation above.
        </p>
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
