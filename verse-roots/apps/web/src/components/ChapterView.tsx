import { useEffect, useRef, useState } from 'react';
import type { OriginalWord, VerseWithWords, StrongsEntry } from '../types';
import { getVerseTranslation } from '@verse-roots/bible-client';
import { fetchNivVerse, isApiBibleConfigured } from '../utils/apiBible';
import { WordChip } from './WordChip';
import { SidePanel } from './SidePanel';
import { formatRef } from '../utils/formatRef';
import type { Study } from '../study/types';
import './ChapterView.css';

const SUPABASE_TRANSLATIONS = ['KJV', 'ASV', 'WEB'];
const NIV_AVAILABLE = isApiBibleConfigured;

const TRANSLATION_ATTRIBUTION: Record<string, string> = {
  KJV: 'KJV (public domain)',
  ASV: 'ASV (public domain)',
  WEB: 'WEB (public domain)',
  NIV: 'NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®',
};

function formatChapterRef(ref: string): string {
  // "Jhn.3" → "John 3"
  const fake = `${ref}.1`;
  const display = formatRef(fake); // "John 3:1"
  return display.replace(/:\d+$/, ''); // "John 3"
}

export interface ChapterViewProps {
  verses: VerseWithWords[];
  chapterRef: string;
  translation: string;
  onTranslationChange: (t: string) => void;
  expandedVerseRef: string | null;
  onVerseExpand: (ref: string) => void;
  selectedWordId: number | null;
  onWordClick: (word: OriginalWord) => void;
  // Inline word panel props
  selectedWord: OriginalWord | null;
  selectedStrongs: StrongsEntry | null;
  onPanelClose: () => void;
  onNavigate: (osisRef: string, strongs: string) => void;
  onStudySaved: (study: Study) => void;
}

export function ChapterView({
  verses,
  chapterRef,
  translation,
  onTranslationChange,
  expandedVerseRef,
  onVerseExpand,
  selectedWordId,
  onWordClick,
  selectedWord,
  selectedStrongs,
  onPanelClose,
  onNavigate,
  onStudySaved,
}: ChapterViewProps) {
  const chapterDisplay = formatChapterRef(chapterRef);

  return (
    <section className="chapter-view">
      <div className="chapter-view__header">
        <div className="chapter-view__title-row">
          <h2 className="chapter-view__ref">{chapterDisplay}</h2>
          <span className="chapter-view__count">{verses.length} verses</span>
        </div>
        <div className="translation-bar">
          <span className="translation-label">Translation:</span>
          <div className="translation-pills" role="group" aria-label="Translation">
            {NIV_AVAILABLE && (
              <button
                className={`translation-pill${translation === 'NIV' ? ' translation-pill--active' : ''}`}
                onClick={() => onTranslationChange('NIV')}
              >NIV</button>
            )}
            {SUPABASE_TRANSLATIONS.map((t) => (
              <button
                key={t}
                className={`translation-pill${translation === t ? ' translation-pill--active' : ''}`}
                onClick={() => onTranslationChange(t)}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="chapter-view__verses">
        {verses.map((verse) => (
          <ChapterVerse
            key={verse.ref}
            verse={verse}
            translation={translation}
            attribution={TRANSLATION_ATTRIBUTION[translation] ?? translation}
            isExpanded={expandedVerseRef === verse.ref}
            onToggle={() => onVerseExpand(verse.ref)}
            selectedWordId={selectedWordId}
            onWordClick={onWordClick}
            selectedWord={selectedWord}
            selectedStrongs={selectedStrongs}
            onPanelClose={onPanelClose}
            onNavigate={onNavigate}
            onStudySaved={onStudySaved}
          />
        ))}
      </div>
    </section>
  );
}

interface ChapterVerseProps {
  verse: VerseWithWords;
  translation: string;
  attribution: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedWordId: number | null;
  onWordClick: (word: OriginalWord) => void;
  selectedWord: OriginalWord | null;
  selectedStrongs: StrongsEntry | null;
  onPanelClose: () => void;
  onNavigate: (osisRef: string, strongs: string) => void;
  onStudySaved: (study: Study) => void;
}

function ChapterVerse({
  verse,
  translation,
  isExpanded,
  onToggle,
  selectedWordId,
  onWordClick,
  selectedWord,
  selectedStrongs,
  onPanelClose,
  onNavigate,
  onStudySaved,
}: ChapterVerseProps) {
  // Show inline panel when this verse is expanded and the selected word belongs to it
  const showInlinePanel =
    isExpanded &&
    selectedWord !== null &&
    verse.words.some((w) => w.id === selectedWord.id);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showInlinePanel) return;
    // Use rAF to wait for paint, then scrollIntoView without smooth (iOS-safe)
    const raf = requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [showInlinePanel]);

  const [text, setText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(true);

  useEffect(() => {
    setText(null);
    setTextLoading(true);
    const load = async () => {
      try {
        if (translation === 'NIV') {
          const t = await fetchNivVerse(verse.ref);
          setText(t);
        } else {
          const d = await getVerseTranslation(verse.ref, translation);
          setText(d?.text ?? null);
        }
      } catch {
        setText(null);
      } finally {
        setTextLoading(false);
      }
    };
    void load();
  }, [verse.ref, translation]);

  return (
    <div className={`chapter-verse${isExpanded ? ' chapter-verse--expanded' : ''}`}>
      <button
        className="chapter-verse__row"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <span className="chapter-verse__num">{verse.verse}</span>
        <span className="chapter-verse__text">
          {textLoading ? <span className="chapter-verse__shimmer" /> : (text ?? '—')}
        </span>
        <span className="chapter-verse__chevron" aria-hidden="true">
          {isExpanded ? '▴' : '▾'}
        </span>
      </button>

      {isExpanded && (
        <div className="chapter-verse__expanded">
          {!showInlinePanel && (
            <p className="chapter-verse__expanded-hint">
              Tap a word to explore its original {verse.testament === 'OT' ? 'Hebrew' : 'Greek'} meaning
            </p>
          )}
          <div className="chapter-verse__words">
            {verse.words.map((word) => (
              <WordChip
                key={word.id}
                word={word}
                selected={word.id === selectedWordId}
                onClick={onWordClick}
              />
            ))}
          </div>
          {showInlinePanel && (
            <div ref={panelRef} className="chapter-verse__panel-anchor">
              <SidePanel
                inline
                word={selectedWord!}
                strongs={selectedStrongs}
                onClose={onPanelClose}
                onNavigate={onNavigate}
                onStudySaved={onStudySaved}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
