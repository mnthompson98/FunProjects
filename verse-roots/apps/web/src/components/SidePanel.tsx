import { useState, useEffect, useRef } from 'react';
import type { OriginalWord, StrongsEntry, ConcordanceResponse, ConcordanceEntry } from '../types';
import { getConcordance } from '@verse-roots/bible-client';
import { formatRef } from '../utils/formatRef';
import { StudyTab } from './StudyTab';
import type { Study } from '../study/types';
import './SidePanel.css';

interface SidePanelProps {
  word: OriginalWord;
  strongs: StrongsEntry | null;
  onClose: () => void;
  /** Called when the user clicks a concordance entry to navigate to that verse. */
  onNavigate: (osisRef: string, strongs: string) => void;
  onStudySaved: (study: Study) => void;
  /** When true, renders inline (no sticky, full-width, border-top instead of border-left) */
  inline?: boolean;
}

type Tab = 'lexicon' | 'concordance' | 'study';

export function SidePanel({
  word,
  strongs,
  onClose,
  onNavigate,
  onStudySaved,
  inline = false,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('lexicon');

  return (
    <aside className={`side-panel${inline ? ' side-panel--inline' : ''}`}>
      <div className="side-panel__header">
        <div className="side-panel__word-info">
          <span className="side-panel__original">{word.originalText}</span>
          {word.strongs && (
            <span className="side-panel__strongs">{word.strongs}</span>
          )}
        </div>
        <button className="side-panel__close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      <div className="side-panel__tabs">
        <button
          className={`tab-btn${activeTab === 'lexicon' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('lexicon')}
        >
          Lexicon
        </button>
        <button
          className={`tab-btn${activeTab === 'concordance' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('concordance')}
        >
          Concordance
        </button>
        <button
          className={`tab-btn${activeTab === 'study' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('study')}
        >
          Study
        </button>
      </div>

      <div className="side-panel__body">
        {activeTab === 'lexicon' && (
          <LexiconTab word={word} strongs={strongs} />
        )}
        {activeTab === 'concordance' && (
          <ConcordanceTab word={word} strongs={strongs} onNavigate={onNavigate} />
        )}
        {activeTab === 'study' && (
          <StudyTab
            verseRef={word.verseRef}
            focusStrongs={word.strongs}
            focusWord={word.originalText}
            focusLemma={strongs?.lemma ?? null}
            onStudySaved={onStudySaved}
          />
        )}
      </div>
    </aside>
  );
}

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
          {/* STEPBible uses HTML tags in fullDef */}
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
// ConcordanceTab
// ---------------------------------------------------------------------------

interface ConcordanceTabProps {
  word: OriginalWord;
  strongs: StrongsEntry | null;
  onNavigate: (osisRef: string, strongs: string) => void;
}

function ConcordanceTab({ word, strongs, onNavigate }: ConcordanceTabProps) {
  // Cache keyed by Strong's number so switching tabs doesn't re-fetch
  const cache = useRef<Map<string, ConcordanceResponse>>(new Map());
  const [data, setData] = useState<ConcordanceResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!word.strongs) return;

    const id = word.strongs;

    if (cache.current.has(id)) {
      setData(cache.current.get(id)!);
      return;
    }

    let cancelled = false;
    setFetching(true);
    setFetchError(null);
    setData(null);

    getConcordance(id)
      .then((json: ConcordanceResponse) => {
        if (cancelled) return;
        cache.current.set(id, json);
        setData(json);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [word.strongs]);

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
  const countLabel =
    data.total > data.results.length
      ? `${data.total}+ occurrences`
      : `${data.total} occurrence${data.total === 1 ? '' : 's'}`;

  return (
    <div className="concordance-tab">
      <p className="concordance-header">
        {countLabel} of <span className="concordance-header__lemma">{lemmaLabel}</span>{' '}
        <span className="concordance-header__strongs">({word.strongs})</span>
      </p>
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
