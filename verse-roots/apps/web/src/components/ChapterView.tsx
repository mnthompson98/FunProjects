import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OriginalWord, VerseWithWords, StrongsEntry } from '../types';
import { getVerseTranslation } from '@verse-roots/bible-client';
import { fetchNivVerse, isApiBibleConfigured } from '../utils/apiBible';
import { WordChip } from './WordChip';
import { SidePanel } from './SidePanel';
import { AddMemoryButton } from './AddMemoryButton';
import { formatRef, formatPassageRef, buildPassageRef } from '../utils/formatRef';
import type { ReflectionSelection } from '../study/types';
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

function verseNum(ref: string): number {
  return parseInt(ref.split('.')[2] ?? '0', 10);
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
  onReflectVerse?: (verseRef: string) => void;
  // Passage reflection
  onStartReflection: (selection: ReflectionSelection) => void;
  onAddToMemory?: (ref: string, scope: 'verse' | 'chapter', display: string) => Promise<'added' | 'exists'>;
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
  onReflectVerse,
  onStartReflection,
  onAddToMemory,
}: ChapterViewProps) {
  const chapterDisplay = formatChapterRef(chapterRef);

  // ── Select mode (passage reflection) ──
  const [selectMode, setSelectMode] = useState(false);
  const [selectedVerses, setSelectedVerses] = useState<Set<string>>(new Set());
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
  const [wordPickVerse, setWordPickVerse] = useState<string | null>(null);
  // English text per verse, lifted up from each row so we can snapshot the selection
  const [verseText, setVerseText] = useState<Map<string, string>>(new Map());

  const reportText = useCallback((ref: string, text: string) => {
    setVerseText((prev) => {
      if (prev.get(ref) === text) return prev;
      const next = new Map(prev);
      next.set(ref, text);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedVerses(new Set());
    setSelectedWords(new Set());
    setWordPickVerse(null);
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    clearSelection();
  }, [clearSelection]);

  // Map word id → its word + verse, for snapshot building + mutual exclusivity
  const wordIndex = useMemo(() => {
    const m = new Map<number, { word: OriginalWord; verseRef: string }>();
    verses.forEach((v) => v.words.forEach((w) => m.set(w.id, { word: w, verseRef: v.ref })));
    return m;
  }, [verses]);

  const verseByRef = useMemo(() => {
    const m = new Map<string, VerseWithWords>();
    verses.forEach((v) => m.set(v.ref, v));
    return m;
  }, [verses]);

  // Selecting a whole verse and selecting specific words from it are mutually
  // exclusive — picking the verse clears its word picks, and vice versa.
  const toggleVerse = useCallback((ref: string) => {
    const verse = verseByRef.get(ref);
    setSelectedVerses((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
    if (verse) {
      setSelectedWords((prev) => {
        if (!verse.words.some((w) => prev.has(w.id))) return prev;
        const next = new Set(prev);
        verse.words.forEach((w) => next.delete(w.id));
        return next;
      });
    }
  }, [verseByRef]);

  const toggleWord = useCallback((id: number) => {
    const hit = wordIndex.get(id);
    setSelectedWords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Picking a specific word means we no longer want the whole verse
    if (hit) {
      setSelectedVerses((prev) => {
        if (!prev.has(hit.verseRef)) return prev;
        const next = new Set(prev);
        next.delete(hit.verseRef);
        return next;
      });
    }
  }, [wordIndex]);

  const hasSelection = selectedVerses.size > 0 || selectedWords.size > 0;

  const handleReflect = useCallback(() => {
    // Gather every verse number touched by a whole-verse or word selection
    const involvedNums = new Set<number>();
    selectedVerses.forEach((ref) => involvedNums.add(verseNum(ref)));
    selectedWords.forEach((id) => {
      const hit = wordIndex.get(id);
      if (hit) involvedNums.add(verseNum(hit.verseRef));
    });
    if (involvedNums.size === 0) return;

    const nums = Array.from(involvedNums).sort((a, b) => a - b);
    const [bookCode, chapter] = chapterRef.split('.');
    const passageRef = buildPassageRef(bookCode, chapter, nums);
    const startVerseRef = `${bookCode}.${chapter}.${nums[0]}`;

    // Build a readable snapshot, verse by verse in order. Whole verses use the
    // English translation; specific word picks show original (English gloss).
    const fragments: string[] = [];
    for (const n of nums) {
      const ref = `${bookCode}.${chapter}.${n}`;
      const verse = verseByRef.get(ref);
      if (selectedVerses.has(ref)) {
        fragments.push(verseText.get(ref) ?? verse?.words.map((w) => w.originalText).join(' ') ?? '');
      } else {
        const picked = (verse?.words ?? [])
          .filter((w) => selectedWords.has(w.id))
          .map((w) => (w.gloss ? `${w.originalText} (${w.gloss})` : w.originalText));
        if (picked.length) fragments.push(picked.join(', '));
      }
    }
    const text = fragments.join(' ').trim().slice(0, 600);

    onStartReflection({
      passageRef,
      startVerseRef,
      verseRefs: Array.from(selectedVerses).sort((a, b) => verseNum(a) - verseNum(b)),
      wordIds: Array.from(selectedWords),
      snapshot: { text, wordIds: Array.from(selectedWords) },
    });
    // Intentionally NOT exiting select mode — the user keeps their selection
    // and decides when to Clear or tap Done.
  }, [selectedVerses, selectedWords, wordIndex, chapterRef, verseText, verseByRef, onStartReflection]);

  const selectionLabel = useMemo(() => {
    if (!hasSelection) return '';
    const involvedNums = new Set<number>();
    selectedVerses.forEach((ref) => involvedNums.add(verseNum(ref)));
    selectedWords.forEach((id) => {
      const hit = wordIndex.get(id);
      if (hit) involvedNums.add(verseNum(hit.verseRef));
    });
    const nums = Array.from(involvedNums).sort((a, b) => a - b);
    const [bookCode, chapter] = chapterRef.split('.');
    const passageRef = buildPassageRef(bookCode, chapter, nums);
    const parts: string[] = [formatPassageRef(passageRef)];
    if (selectedVerses.size) parts.push(`${selectedVerses.size} verse${selectedVerses.size === 1 ? '' : 's'}`);
    if (selectedWords.size) parts.push(`${selectedWords.size} word${selectedWords.size === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }, [hasSelection, selectedVerses, selectedWords, wordIndex, chapterRef]);

  return (
    <section className="chapter-view">
      <div className="chapter-view__header">
        <div className="chapter-view__title-row">
          <h2 className="chapter-view__ref">{chapterDisplay}</h2>
          <span className="chapter-view__count">{verses.length} verses</span>
          {onAddToMemory && (
            <span className="chapter-view__addmem">
              <AddMemoryButton
                label="Add chapter to Memory"
                onAdd={() => onAddToMemory(chapterRef, 'chapter', chapterDisplay)}
              />
            </span>
          )}
        </div>
        {selectMode && (
          <p className="chapter-view__select-hint">
            Tap a verse to select it, or tap <strong>▾</strong> to choose specific words within it.
          </p>
        )}
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
            onReflectVerse={onReflectVerse}
            onTextLoaded={reportText}
            selectMode={selectMode}
            isSelected={selectedVerses.has(verse.ref)}
            onToggleSelect={() => toggleVerse(verse.ref)}
            showWordPick={wordPickVerse === verse.ref}
            onToggleWordPick={() => setWordPickVerse((p) => (p === verse.ref ? null : verse.ref))}
            selectedWords={selectedWords}
            onToggleWord={toggleWord}
          />
        ))}
      </div>

      <div className="chapter-fab">
        {!selectMode ? (
          <button className="chapter-fab__enter" onClick={() => setSelectMode(true)}>
            ✎ Reflect on a passage
          </button>
        ) : (
          <div className="chapter-fab__bar" role="region" aria-label="Passage selection">
            <button className="chapter-fab__done" onClick={exitSelectMode}>Done</button>
            {hasSelection ? (
              <>
                <span className="chapter-fab__label">{selectionLabel}</span>
                <div className="chapter-fab__actions">
                  <button className="reflect-bar__clear" onClick={clearSelection}>Clear</button>
                  <button className="reflect-bar__go" onClick={handleReflect}>Reflect →</button>
                </div>
              </>
            ) : (
              <span className="chapter-fab__placeholder">Tap verses to select</span>
            )}
          </div>
        )}
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
  onReflectVerse?: (verseRef: string) => void;
  onTextLoaded: (ref: string, text: string) => void;
  // Select mode
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  showWordPick: boolean;
  onToggleWordPick: () => void;
  selectedWords: Set<number>;
  onToggleWord: (id: number) => void;
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
  onReflectVerse,
  onTextLoaded,
  selectMode,
  isSelected,
  onToggleSelect,
  showWordPick,
  onToggleWordPick,
  selectedWords,
  onToggleWord,
}: ChapterVerseProps) {
  // Show inline panel when this verse is expanded and the selected word belongs to it
  const showInlinePanel =
    isExpanded &&
    selectedWord !== null &&
    verse.words.some((w) => w.id === selectedWord.id);
  // Callback ref fires exactly when the panel div mounts — no timing guesswork
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const timer = setTimeout(() => {
      let top = 0;
      let el: HTMLElement | null = node;
      while (el) { top += el.offsetTop; el = el.offsetParent as HTMLElement | null; }
      const HEADER = 76; // 60px header + 16px breathing room
      const target = Math.max(0, top - HEADER);
      window.scroll(0, target);
      document.documentElement.scrollTop = target;
      document.body.scrollTop = target;
    }, 300);
    return () => clearTimeout(timer);
  }, []);

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
          if (t) onTextLoaded(verse.ref, t);
        } else {
          const d = await getVerseTranslation(verse.ref, translation);
          setText(d?.text ?? null);
          if (d?.text) onTextLoaded(verse.ref, d.text);
        }
      } catch {
        setText(null);
      } finally {
        setTextLoading(false);
      }
    };
    void load();
  }, [verse.ref, translation, onTextLoaded]);

  const hasPickedWords = verse.words.some((w) => selectedWords.has(w.id));
  const rowClass = selectMode
    ? [
        'chapter-verse__row--selectable',
        isSelected ? 'chapter-verse__row--selected' : '',
        !isSelected && hasPickedWords ? 'chapter-verse__row--partial' : '',
      ].filter(Boolean).join(' ')
    : 'chapter-verse__row';

  return (
    <div className={`chapter-verse${isExpanded ? ' chapter-verse--expanded' : ''}`}>
      {selectMode ? (
        <div className={rowClass}>
          <button
            className="chapter-verse__select-zone"
            onClick={onToggleSelect}
            aria-pressed={isSelected}
          >
            <span className={`chapter-verse__check${isSelected ? ' chapter-verse__check--on' : ''}`} aria-hidden="true">
              {isSelected ? '✓' : ''}
            </span>
            <span className="chapter-verse__num">{verse.verse}</span>
            <span className="chapter-verse__text">
              {textLoading ? <span className="chapter-verse__shimmer" /> : (text ?? '—')}
            </span>
          </button>
          <button
            className={`chapter-verse__words-toggle${showWordPick ? ' chapter-verse__words-toggle--open' : ''}`}
            onClick={onToggleWordPick}
            aria-expanded={showWordPick}
            title="Choose specific words"
          >
            <span aria-hidden="true">{showWordPick ? '▴' : '▾'}</span>
          </button>
        </div>
      ) : (
        <button
          className={rowClass}
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
      )}

      {selectMode && showWordPick && (
        <div className="chapter-verse__pick-words">
          {verse.words.map((word) => (
            <button
              key={word.id}
              className={`pick-word${selectedWords.has(word.id) ? ' pick-word--on' : ''}`}
              onClick={() => onToggleWord(word.id)}
            >
              <span className="pick-word__original">{word.originalText}</span>
              {word.gloss && <span className="pick-word__gloss">{word.gloss}</span>}
            </button>
          ))}
        </div>
      )}

      {!selectMode && isExpanded && (
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
                onReflect={onReflectVerse}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
