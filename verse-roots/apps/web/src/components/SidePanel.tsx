import { useState, useEffect, useRef, useCallback } from 'react';
import type { OriginalWord, StrongsEntry, ConcordanceResponse, ConcordanceEntry } from '../types';
import { getConcordance } from '@verse-roots/bible-client';
import { formatRef } from '../utils/formatRef';
import './SidePanel.css';

interface SidePanelProps {
  word: OriginalWord;
  strongs: StrongsEntry | null;
  onClose: () => void;
  onNavigate: (osisRef: string, strongs: string) => void;
  onReflect?: (verseRef: string) => void;
  inline?: boolean;
}

type Tab = 'lexicon' | 'concordance';

export function SidePanel({
  word,
  strongs,
  onClose,
  onNavigate,
  onReflect,
  inline = false,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('lexicon');
  const [showExplorer, setShowExplorer] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  // Scroll panel back to top whenever the view changes
  const scrollPanelTop = useCallback(() => {
    if (asideRef.current) asideRef.current.scrollTop = 0;
  }, []);

  // Concordance data lifted here so explorer can be opened from the header
  const concordanceCache = useRef<Map<string, ConcordanceResponse>>(new Map());
  const [concordanceData, setConcordanceData] = useState<ConcordanceResponse | null>(null);
  const [concordanceFetching, setConcordanceFetching] = useState(false);
  const [concordanceError, setConcordanceError] = useState<string | null>(null);

  // Reset explorer + concordance whenever the selected word changes
  useEffect(() => {
    setShowExplorer(false);
    setConcordanceData(null);
    setConcordanceFetching(false);
    setConcordanceError(null);
    scrollPanelTop();
  }, [word.strongs, scrollPanelTop]);

  // Scroll to top when switching tabs or opening explorer
  useEffect(() => { scrollPanelTop(); }, [activeTab, showExplorer, scrollPanelTop]);

  // Fetch concordance when tab is opened or when explorer is triggered from header
  const ensureConcordance = () => {
    if (!word.strongs) return;
    const id = word.strongs;
    if (concordanceCache.current.has(id)) {
      setConcordanceData(concordanceCache.current.get(id)!);
      return;
    }
    if (concordanceFetching) return;
    setConcordanceFetching(true);
    getConcordance(id)
      .then((json) => {
        concordanceCache.current.set(id, json);
        setConcordanceData(json);
      })
      .catch((err: unknown) => {
        setConcordanceError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setConcordanceFetching(false));
  };

  const handleOpenExplorer = () => {
    ensureConcordance();
    setShowExplorer(true);
  };

  const lemmaLabel = strongs?.lemma ?? word.originalText;

  return (
    <aside ref={asideRef} className={`side-panel${inline ? ' side-panel--inline' : ''}`}>
      <div className="side-panel__header">
        <div className="side-panel__word-info">
          {word.strongs ? (
            <button
              className="side-panel__original side-panel__original--btn"
              onClick={handleOpenExplorer}
              title="Explore all occurrences by book"
            >
              {word.originalText}
            </button>
          ) : (
            <span className="side-panel__original">{word.originalText}</span>
          )}
          {word.strongs && (
            <span className="side-panel__strongs">{word.strongs}</span>
          )}
        </div>
        <button className="side-panel__close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      {showExplorer ? (
        <div className="side-panel__body">
          <WordExplorer
            lemma={lemmaLabel}
            strongs={word.strongs!}
            data={concordanceData}
            fetching={concordanceFetching}
            fetchError={concordanceError}
            onNavigate={onNavigate}
            onBack={() => setShowExplorer(false)}
          />
        </div>
      ) : (
        <>
          <div className="side-panel__tabs">
            <button
              className={`tab-btn${activeTab === 'lexicon' ? ' tab-btn--active' : ''}`}
              onClick={() => setActiveTab('lexicon')}
            >
              Lexicon
            </button>
            <button
              className={`tab-btn${activeTab === 'concordance' ? ' tab-btn--active' : ''}`}
              onClick={() => { setActiveTab('concordance'); ensureConcordance(); }}
            >
              Concordance
            </button>
          </div>

          <div className="side-panel__body">
            {activeTab === 'lexicon' && (
              <LexiconTab word={word} strongs={strongs} />
            )}
            {activeTab === 'concordance' && (
              <ConcordanceTab
                word={word}
                strongs={strongs}
                data={concordanceData}
                fetching={concordanceFetching}
                fetchError={concordanceError}
                onNavigate={onNavigate}
                onOpenExplorer={handleOpenExplorer}
              />
            )}
            {onReflect && (
              <button className="side-panel__reflect" onClick={() => onReflect(word.verseRef)}>
                ✎ Reflect on this verse
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// LexiconTab
// ---------------------------------------------------------------------------

function LexiconTab({ word, strongs }: { word: OriginalWord; strongs: StrongsEntry | null }) {
  if (!strongs) {
    return (
      <div className="lexicon-tab">
        {word.strongs ? (
          <p className="lexicon-no-entry">No lexicon entry found for {word.strongs}</p>
        ) : (
          <p className="lexicon-no-entry">This word has no Strong&apos;s number.</p>
        )}
      </div>
    );
  }

  return (
    <div className="lexicon-tab">
      <dl className="lexicon-fields">
        {strongs.lemma && (
          <>
            <dt>Lemma</dt>
            <dd className="lexicon-lemma">{strongs.lemma}</dd>
          </>
        )}
        {strongs.transliteration && (
          <>
            <dt>Transliteration</dt>
            <dd>{strongs.transliteration}</dd>
          </>
        )}
        <dt>Language</dt>
        <dd className="lexicon-language">{strongs.language === 'hebrew' ? 'Hebrew / Aramaic' : 'Greek'}</dd>
        {strongs.shortDef && (
          <>
            <dt>Short definition</dt>
            <dd className="lexicon-shortdef">{strongs.shortDef}</dd>
          </>
        )}
      </dl>
      {strongs.fullDef && (
        <div className="lexicon-fulldef">
          <h4>Full definition</h4>
          <div
            className="lexicon-fulldef__content"
            dangerouslySetInnerHTML={{ __html: strongs.fullDef }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConcordanceTab — receives lifted data, no longer fetches itself
// ---------------------------------------------------------------------------

interface ConcordanceTabProps {
  word: OriginalWord;
  strongs: StrongsEntry | null;
  data: ConcordanceResponse | null;
  fetching: boolean;
  fetchError: string | null;
  onNavigate: (osisRef: string, strongs: string) => void;
  onOpenExplorer: () => void;
}

function ConcordanceTab({ word, strongs, data, fetching, fetchError, onNavigate, onOpenExplorer }: ConcordanceTabProps) {
  if (!word.strongs) {
    return (
      <div className="concordance-tab">
        <p className="concordance-no-strongs">This word has no Strong&apos;s number.</p>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="concordance-tab">
        <div className="concordance-spinner" aria-label="Loading concordance" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="concordance-tab">
        <p className="concordance-error">Failed to load concordance: {fetchError}</p>
      </div>
    );
  }

  if (!data) return null;

  const lemmaLabel = strongs?.lemma ?? word.originalText;
  const shown = data.results.length;
  const countLabel = data.total > shown
    ? `${data.total} occurrences (showing ${shown})`
    : `${data.total} occurrence${data.total === 1 ? '' : 's'}`;

  return (
    <div className="concordance-tab">
      <div className="concordance-header">
        <span>{countLabel} of <span className="concordance-header__lemma">{lemmaLabel}</span>{' '}
        <span className="concordance-header__strongs">({word.strongs})</span></span>
        <button className="concordance-header__explore-btn" onClick={onOpenExplorer}>
          Browse by book →
        </button>
      </div>
      <ul className="concordance-list">
        {data.results.map((entry) => (
          <ConcordanceItem
            key={entry.verseRef}
            entry={entry}
            strongs={word.strongs!}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConcordanceItem
// ---------------------------------------------------------------------------

interface ConcordanceItemProps {
  entry: ConcordanceEntry;
  strongs: string;
  onNavigate: (osisRef: string, strongs: string) => void;
}

function ConcordanceItem({ entry, strongs, onNavigate }: ConcordanceItemProps) {
  const handleActivate = () => onNavigate(entry.verseRef, strongs);

  return (
    <li
      className="concordance-item"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      <span className="concordance-item__ref">{formatRef(entry.verseRef)}</span>
      {entry.words.length > 0 && (
        <span className="concordance-item__words">
          {entry.words.map((w, i) => (
            <span key={i} className="concordance-item__word">
              <span className="concordance-item__original">{w.originalText}</span>
              {w.gloss && (
                <span className="concordance-item__gloss"> — {w.gloss}</span>
              )}
            </span>
          ))}
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// WordExplorer — grouped by book, rendered in panel body
// ---------------------------------------------------------------------------

interface WordExplorerProps {
  lemma: string;
  strongs: string;
  data: ConcordanceResponse | null;
  fetching: boolean;
  fetchError: string | null;
  onNavigate: (osisRef: string, strongs: string) => void;
  onBack: () => void;
}

interface BookGroup {
  book: string;
  chapters: Map<number, ConcordanceEntry[]>;
}

function groupByBook(results: ConcordanceEntry[]): BookGroup[] {
  const bookMap = new Map<string, Map<number, ConcordanceEntry[]>>();
  for (const entry of results) {
    if (!bookMap.has(entry.book)) bookMap.set(entry.book, new Map());
    const chMap = bookMap.get(entry.book)!;
    if (!chMap.has(entry.chapter)) chMap.set(entry.chapter, []);
    chMap.get(entry.chapter)!.push(entry);
  }
  return Array.from(bookMap.entries()).map(([book, chapters]) => ({ book, chapters }));
}

function WordExplorer({ lemma, strongs, data, fetching, fetchError, onNavigate, onBack }: WordExplorerProps) {
  const groups = data ? groupByBook(data.results) : [];
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set());

  // Expand the first book once data loads
  useEffect(() => {
    if (data && data.results.length > 0) {
      const first = data.results[0].book;
      setExpandedBooks((prev) => prev.size === 0 ? new Set([first]) : prev);
    }
  }, [data]);

  const toggleBook = (book: string) => {
    setExpandedBooks((prev) => {
      const next = new Set(prev);
      if (next.has(book)) next.delete(book);
      else next.add(book);
      return next;
    });
  };

  const shown = data?.results.length ?? 0;
  const total = data?.total ?? 0;
  const countNote = total > shown ? ` (${shown} of ${total} shown)` : '';

  return (
    <div className="word-explorer">
      <div className="word-explorer__header">
        <button className="word-explorer__back" onClick={onBack}>← Concordance</button>
        <div className="word-explorer__title">
          <span className="word-explorer__lemma">{lemma}</span>
          <span className="word-explorer__strongs">{strongs}</span>
        </div>
        {data && <p className="word-explorer__count">{total} occurrence{total === 1 ? '' : 's'}{countNote}</p>}
      </div>

      {fetching && <div className="concordance-spinner" aria-label="Loading" />}
      {fetchError && <p className="concordance-error">{fetchError}</p>}

      {data && (
        <div className="word-explorer__books">
          {groups.map(({ book, chapters }) => {
            const isOpen = expandedBooks.has(book);
            const bookTotal = Array.from(chapters.values()).reduce((n, arr) => n + arr.length, 0);
            return (
              <div key={book} className="word-explorer__book">
                <button
                  className={`word-explorer__book-btn${isOpen ? ' word-explorer__book-btn--open' : ''}`}
                  onClick={() => toggleBook(book)}
                >
                  <span className="word-explorer__book-name">{book}</span>
                  <span className="word-explorer__book-count">{bookTotal}</span>
                  <span className="word-explorer__book-chevron">{isOpen ? '▴' : '▾'}</span>
                </button>
                {isOpen && (
                  <div className="word-explorer__chapters">
                    {Array.from(chapters.entries()).map(([chapter, entries]) => (
                      <div key={chapter} className="word-explorer__chapter">
                        <span className="word-explorer__chapter-label">Ch. {chapter}</span>
                        <div className="word-explorer__verses">
                          {entries.map((entry) => (
                            <button
                              key={entry.verseRef}
                              className="word-explorer__verse-btn"
                              onClick={() => onNavigate(entry.verseRef, strongs)}
                              title={entry.words.map(w => w.gloss).filter(Boolean).join(', ')}
                            >
                              v{entry.verse}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
