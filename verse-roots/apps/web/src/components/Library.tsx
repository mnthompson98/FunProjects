import { useState, useEffect, useMemo } from 'react';
import { Study } from '../study/types';
import { getAllStudies, deleteStudy } from '../study/db';
import { formatRef } from '../utils/formatRef';
import './Library.css';

interface LibraryProps {
  onOpen: (verseRef: string) => void;
  onClose: () => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function getBookFromRef(verseRef: string): string {
  return formatRef(verseRef).split(' ').slice(0, -1).join(' ');
}

function getContextSnippet(study: Study): string {
  const ctx = study.sections.find((s) => s.id === 'context');
  const text = ctx?.content ?? study.sections.find((s) => s.content)?.content ?? '';
  return text.length > 100 ? text.slice(0, 100) + '…' : text;
}

export function Library({ onOpen, onClose }: LibraryProps) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [wordsFilter, setWordsFilter] = useState('');

  useEffect(() => {
    getAllStudies().then(setStudies);
  }, []);

  const books = useMemo(() => {
    const set = new Set<string>();
    studies.forEach((s) => set.add(getBookFromRef(s.verseRef)));
    return Array.from(set).sort();
  }, [studies]);

  const words = useMemo(() => {
    const set = new Set<string>();
    studies.forEach((s) => {
      if (s.focusStrongs) set.add(s.focusStrongs);
    });
    return Array.from(set).sort();
  }, [studies]);

  const filtered = useMemo(() => {
    return studies.filter((s) => {
      if (bookFilter && getBookFromRef(s.verseRef) !== bookFilter) return false;
      if (wordsFilter && s.focusStrongs !== wordsFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const inTitle = s.title.toLowerCase().includes(q);
        const inContent = s.sections.some((sec) => sec.content.toLowerCase().includes(q));
        if (!inTitle && !inContent) return false;
      }
      return true;
    });
  }, [studies, search, bookFilter, wordsFilter]);

  const handleOpen = (study: Study) => {
    onOpen(study.verseRef);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, study: Study) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${study.title}"?`)) return;
    await deleteStudy(study.id);
    setStudies((prev) => prev.filter((s) => s.id !== study.id));
  };

  return (
    <div className="library-overlay" onClick={onClose}>
      <div className="library-panel" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <button className="library-back" onClick={onClose}>
            ← Back
          </button>
          <h2 className="library-title">My Study Library</h2>
        </div>

        <div className="library-filters">
          <input
            className="library-search"
            type="search"
            placeholder="Search studies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="library-dropdowns">
            <select
              className="library-select"
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
            >
              <option value="">All books</option>
              {books.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              className="library-select"
              value={wordsFilter}
              onChange={(e) => setWordsFilter(e.target.value)}
            >
              <option value="">All words</option>
              {words.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="library-list">
          {filtered.length === 0 ? (
            <p className="library-empty">
              {studies.length === 0
                ? 'No studies yet. Start by looking up a verse.'
                : 'No studies match your filters.'}
            </p>
          ) : (
            filtered.map((study) => (
              <StudyCard
                key={study.id}
                study={study}
                onClick={() => handleOpen(study)}
                onDelete={(e) => handleDelete(e, study)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface StudyCardProps {
  study: Study;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function StudyCard({ study, onClick, onDelete }: StudyCardProps) {
  const snippet = getContextSnippet(study);
  const wordLabel = [study.focusStrongs, study.focusWord].filter(Boolean).join(' ');

  return (
    <div className="study-card" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <div className="study-card__top">
        <span className="study-card__ref">{formatRef(study.verseRef)}</span>
        <span className="study-card__time">{relativeTime(study.updatedAt)}</span>
      </div>
      <div className="study-card__title">{study.title}</div>
      {wordLabel && <div className="study-card__word">{wordLabel}</div>}
      {snippet && <div className="study-card__snippet">"{snippet}"</div>}
      <button
        className="study-card__delete"
        onClick={onDelete}
        aria-label="Delete study"
      >
        ×
      </button>
    </div>
  );
}
