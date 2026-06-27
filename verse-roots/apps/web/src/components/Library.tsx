import { useState, useEffect, useMemo, useRef } from 'react';

const ALL_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalm','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians',
  'Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy',
  'Titus','Philemon','Hebrews','James','1 Peter','2 Peter',
  '1 John','2 John','3 John','Jude','Revelation',
];
import type { Study } from '../study/types';
import type { StudyGroup } from '../study/types';
import { getAllStudies, deleteStudy, saveStudy, getAllGroups, saveGroup, deleteGroup } from '../study/db';
import { formatRef } from '../utils/formatRef';
import './Library.css';

const GROUP_COLORS = ['#C9954A','#4A7FA5','#5A8A6E','#A84848','#8B6F9B','#4A8FA5'];

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
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [wordsFilter, setWordsFilter] = useState('');
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllStudies().then(setStudies);
    getAllGroups().then(setGroups);
  }, []);

  const handleExport = () => {
    const json = JSON.stringify(studies, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verse-roots-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const text = await file.text();
    try {
      const imported = JSON.parse(text) as Study[];
      if (!Array.isArray(imported)) throw new Error('Not an array');
      await Promise.all(imported.map((s) => saveStudy(s)));
      const all = await getAllStudies();
      setStudies(all);
    } catch {
      setImportError("Could not read file — make sure it's a Verse Roots library export.");
    }
    // reset so the same file can be re-imported
    if (importRef.current) importRef.current.value = '';
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const group: StudyGroup = {
      id: crypto.randomUUID(),
      name,
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      createdAt: Date.now(),
    };
    await saveGroup(group);
    setGroups((prev) => [...prev, group]);
    setNewGroupName('');
    setShowGroupInput(false);
  };

  const handleDeleteGroup = async (id: string) => {
    await deleteGroup(id);
    // Un-assign studies in this group
    const affected = studies.filter((s) => s.groupId === id);
    await Promise.all(affected.map((s) => saveStudy({ ...s, groupId: null })));
    setStudies((prev) => prev.map((s) => s.groupId === id ? { ...s, groupId: null } : s));
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (groupFilter === id) setGroupFilter('');
  };

  const handleAssignGroup = async (study: Study, groupId: string | null) => {
    const updated = { ...study, groupId, updatedAt: Date.now() };
    await saveStudy(updated);
    setStudies((prev) => prev.map((s) => s.id === study.id ? updated : s));
  };

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
      if (groupFilter) {
        if (groupFilter === '__none__') {
          if (s.groupId) return false;
        } else {
          if (s.groupId !== groupFilter) return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        const inTitle = s.title.toLowerCase().includes(q);
        const inContent = s.sections.some((sec) => sec.content.toLowerCase().includes(q));
        if (!inTitle && !inContent) return false;
      }
      return true;
    });
  }, [studies, search, bookFilter, wordsFilter, groupFilter]);

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
          <div className="library-header-actions">
            <button className="library-action-btn" onClick={() => setShowGroupInput((v) => !v)} title="Manage groups">
              Groups
            </button>
            <button className="library-action-btn" onClick={handleExport} title="Export library as JSON">
              Export
            </button>
            <button className="library-action-btn" onClick={() => importRef.current?.click()} title="Import library from JSON">
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </div>
        </div>
        {importError && <p className="library-import-error">{importError}</p>}
        {showGroupInput && (
          <div className="library-group-manager">
            <div className="library-group-manager__create">
              <input
                className="library-group-input"
                placeholder="New group name…"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                autoFocus
              />
              <button className="library-action-btn" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                Create
              </button>
            </div>
            {groups.length > 0 && (
              <div className="library-group-manager__list">
                {groups.map((g) => (
                  <div key={g.id} className="library-group-manager__item">
                    <span className="library-group-manager__dot" style={{ background: g.color }} />
                    <span className="library-group-manager__name">{g.name}</span>
                    <button
                      className="library-group-manager__delete"
                      onClick={() => handleDeleteGroup(g.id)}
                      aria-label={`Delete group ${g.name}`}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
              {ALL_BOOKS.map((b) => (
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

        {/* Groups filter bar */}
        {groups.length > 0 && (
          <div className="library-groups">
            <button
              className={`library-group-pill${groupFilter === '' ? ' library-group-pill--active' : ''}`}
              onClick={() => setGroupFilter('')}
            >All</button>
            {groups.map((g) => (
              <button
                key={g.id}
                className={`library-group-pill${groupFilter === g.id ? ' library-group-pill--active' : ''}`}
                style={{ '--group-color': g.color } as React.CSSProperties}
                onClick={() => setGroupFilter(g.id)}
              >
                <span className="library-group-pill__dot" />
                {g.name}
              </button>
            ))}
            <button
              className={`library-group-pill${groupFilter === '__none__' ? ' library-group-pill--active' : ''}`}
              onClick={() => setGroupFilter('__none__')}
            >Ungrouped</button>
          </div>
        )}

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
                groups={groups}
                onClick={() => handleOpen(study)}
                onDelete={(e) => handleDelete(e, study)}
                onAssignGroup={(gId) => handleAssignGroup(study, gId)}
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
  groups: StudyGroup[];
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onAssignGroup: (groupId: string | null) => void;
}

function StudyCard({ study, groups, onClick, onDelete, onAssignGroup }: StudyCardProps) {
  const snippet = getContextSnippet(study);
  const wordLabel = [study.focusStrongs, study.focusWord].filter(Boolean).join(' ');
  const currentGroup = groups.find((g) => g.id === study.groupId);
  const [showGroupSelect, setShowGroupSelect] = useState(false);

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
      <div className="study-card__footer">
        <button
          className="study-card__group-badge"
          style={currentGroup ? { '--group-color': currentGroup.color } as React.CSSProperties : undefined}
          onClick={(e) => { e.stopPropagation(); setShowGroupSelect((v) => !v); }}
          title="Assign to group"
        >
          {currentGroup ? (
            <><span className="study-card__group-dot" />{currentGroup.name}</>
          ) : (
            <span className="study-card__group-none">+ Group</span>
          )}
        </button>
      </div>
      {showGroupSelect && (
        <div className="study-card__group-select" onClick={(e) => e.stopPropagation()}>
          <button className="study-card__group-option" onClick={() => { onAssignGroup(null); setShowGroupSelect(false); }}>
            No group
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`study-card__group-option${study.groupId === g.id ? ' study-card__group-option--active' : ''}`}
              onClick={() => { onAssignGroup(g.id); setShowGroupSelect(false); }}
            >
              <span className="study-card__group-dot" style={{ background: g.color }} />{g.name}
            </button>
          ))}
        </div>
      )}
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
