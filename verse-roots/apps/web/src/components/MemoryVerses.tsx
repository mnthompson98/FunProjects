import { useEffect, useState } from 'react';
import { MEMORY_VERSE_GROUPS } from '../study/memoryVerses';
import type { MemoryItem } from '../study/memory';
import { getAllMemoryItems, saveMemoryItem, deleteMemoryItem } from '../study/db';
import { normalizeRef } from '../normalizeRef';
import { formatRef } from '../utils/formatRef';
import { MemorySession } from './MemorySession';
import { OverlayNav } from './OverlayNav';
import { getStreak, bumpStreak, isStreakActive } from '../utils/streak';
import { showToast } from '../utils/toast';
import './MemoryVerses.css';

interface MemoryVersesProps {
  translation: string;
  onClose: () => void;
  onHome: () => void;
  onLibrary: () => void;
  onMemoryVerses: () => void;
}

function toFirstVerseRef(displayRef: string): string {
  return normalizeRef(displayRef.replace(/[-,].*$/, ''));
}

function formatChapter(osis: string): string {
  return formatRef(`${osis}.1`).replace(/:\d+$/, '');
}

function relativeTime(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function MemoryVerses({ translation, onClose, onHome, onLibrary, onMemoryVerses }: MemoryVersesProps) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [active, setActive] = useState<MemoryItem | null>(null);
  const [streak, setStreak] = useState(() => getStreak());

  useEffect(() => { getAllMemoryItems().then(setItems); }, []);
  const refresh = () => getAllMemoryItems().then(setItems);

  // Escape closes the open session first, then the Memory Verses tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setActive((cur) => {
        if (cur) return null;
        onClose();
        return cur;
      });
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const addItem = async (ref: string, scope: 'verse' | 'chapter', display: string, opts?: { topic?: string; source?: 'tms' | 'custom' }) => {
    if (items.some((i) => i.ref === ref)) return false;
    const item: MemoryItem = {
      id: crypto.randomUUID(),
      ref, scope, display,
      topic: opts?.topic,
      source: opts?.source ?? 'custom',
      addedAt: Date.now(),
    };
    await saveMemoryItem(item);
    await refresh();
    showToast(`Added ${display} ✓`);
    return true;
  };

  const handleAddInput = async () => {
    setAddError('');
    const norm = normalizeRef(addInput.trim());
    if (/^[\w]+\.\d+\.\d+$/.test(norm)) {
      const ok = await addItem(norm, 'verse', formatRef(norm));
      if (ok) setAddInput(''); else setAddError('Already in your list.');
    } else if (/^[\w]+\.\d+$/.test(norm)) {
      const ok = await addItem(norm, 'chapter', formatChapter(norm));
      if (ok) setAddInput(''); else setAddError('Already in your list.');
    } else {
      setAddError('Try a verse like "John 3:16" or a chapter like "John 3".');
    }
  };

  const handlePracticed = async (updated: MemoryItem) => {
    await saveMemoryItem(updated);
    await refresh();
    setActive(updated);
    setStreak(bumpStreak());
    if (updated.memorized) showToast(`${updated.display} memorized ✓`);
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteMemoryItem(id);
    await refresh();
  };

  const inList = (ref: string) => items.some((i) => i.ref === ref);
  const inProgress = items.filter((i) => !i.memorized);
  const memorized = items.filter((i) => i.memorized);

  const renderCard = (it: MemoryItem) => (
    <button key={it.id} className="memverse-card" onClick={() => setActive(it)}>
      <div className="memverse-card__main">
        <span className="memverse-card__ref">{it.display}</span>
        {it.topic && <span className="memverse-card__topic">{it.topic}</span>}
      </div>
      <div className="memverse-card__meta">
        {it.scope === 'chapter' && <span className="memverse-card__badge">Chapter</span>}
        {it.memorized
          ? <span className="memverse-card__times">★ Memorized{it.memorizedAt ? ` · ${relativeTime(it.memorizedAt)}` : ''}</span>
          : it.timesPracticed
            ? <span className="memverse-card__times">Practiced {it.timesPracticed}×{it.lastPracticed ? ` · ${relativeTime(it.lastPracticed)}` : ''}</span>
            : <span className="memverse-card__times">Not started</span>}
      </div>
      <span className="memverse-card__remove" role="button" tabIndex={0} onClick={(e) => handleRemove(e, it.id)} aria-label="Remove">×</span>
    </button>
  );

  return (
    <div className="memverse-overlay" onClick={onClose}>
      <div className="memverse-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Memory Verses">
        <OverlayNav current="memory" onHome={onHome} onLibrary={onLibrary} onMemoryVerses={onMemoryVerses} />
        <div className="memverse-header">
          <button className="memverse-back" onClick={onClose}>← Back</button>
          <h2 className="memverse-title">Memory Verses</h2>
        </div>

        <div className="memverse-add">
          <input
            className="memverse-add__input"
            placeholder='Add a verse or chapter — e.g. "John 3:16" or "John 3"'
            value={addInput}
            onChange={(e) => { setAddInput(e.target.value); setAddError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddInput(); }}
          />
          <button className="memverse-add__btn" onClick={handleAddInput} disabled={!addInput.trim()}>Add</button>
        </div>
        {addError && <p className="memverse-add__error">{addError}</p>}

        {items.length > 0 && (
          <div className="memverse-stats">
            {isStreakActive(streak) && streak.days > 0 && (
              <span className="memverse-stat memverse-stat--streak">🔥 {streak.days}-day streak</span>
            )}
            <div className="memverse-progress">
              <div className="memverse-progress__track">
                <span
                  className="memverse-progress__fill"
                  style={{ width: `${items.length ? Math.round((memorized.length / items.length) * 100) : 0}%` }}
                />
              </div>
              <span className="memverse-progress__label">{memorized.length}/{items.length} memorized</span>
            </div>
          </div>
        )}

        <div className="memverse-list">
          {/* My list (in progress) */}
          <section className="memverse-series">
            <h3 className="memverse-series__name">My List{inProgress.length > 0 ? ` (${inProgress.length})` : ''}</h3>
            {inProgress.length === 0 ? (
              <p className="memverse-empty">Add verses above, from the catalog below, or with the ★ button while reading.</p>
            ) : (
              <div className="memverse-mylist">{inProgress.map(renderCard)}</div>
            )}
          </section>

          {/* Memorized folder */}
          <section className="memverse-series">
            <h3 className="memverse-series__name">★ Memorized{memorized.length > 0 ? ` (${memorized.length})` : ''}</h3>
            {memorized.length === 0 ? (
              <p className="memverse-empty">Verses you mark “Memorized” in a practice session show up here.</p>
            ) : (
              <div className="memverse-mylist">{memorized.map(renderCard)}</div>
            )}
          </section>

          {/* TMS catalog */}
          <p className="memverse-intro">
            The Topical Memory System — key verses grouped by theme, curated by The Navigators. Tap <strong>+</strong> to add one.
          </p>
          {MEMORY_VERSE_GROUPS.map((group) => (
            <section key={group.series} className="memverse-series">
              <h3 className="memverse-series__name">{group.series}</h3>
              <div className="memverse-topics">
                {group.verses.map((v) => (
                  <div key={v.topic} className="memverse-topic">
                    <span className="memverse-topic__name">{v.topic}</span>
                    <div className="memverse-topic__refs">
                      {v.refs.map((ref) => {
                        const osis = toFirstVerseRef(ref);
                        const added = inList(osis);
                        return (
                          <button
                            key={ref}
                            className={`memverse-ref${added ? ' memverse-ref--added' : ''}`}
                            onClick={() => !added && addItem(osis, 'verse', ref, { topic: v.topic, source: 'tms' })}
                            disabled={added}
                          >
                            {ref} {added ? '✓' : '+'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="memverse-attribution">
          Topical Memory System © The Navigators.{' '}
          <a href="https://www.navigators.org/resource/bible-study-tools/" target="_blank" rel="noopener noreferrer">Learn more ↗</a>
        </p>
      </div>

      {active && (
        <MemorySession
          item={active}
          translation={translation}
          onClose={() => setActive(null)}
          onHome={onHome}
          onLibrary={onLibrary}
          onPracticed={handlePracticed}
        />
      )}
    </div>
  );
}
