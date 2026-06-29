import { useState, useEffect, useMemo, useRef, Fragment } from 'react';

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
import { formatRef, formatPassageRef } from '../utils/formatRef';
import { getMethod } from '../study/methods';
import { OverlayNav } from './OverlayNav';
import { SignInNudge } from './SignInNudge';
import { useEscToClose } from '../hooks/useEscToClose';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { showToast } from '../utils/toast';
import './Library.css';

type KindFilter = 'all' | 'word' | 'passage';

function studyKind(study: Study): 'word' | 'passage' {
  return study.kind === 'passage' ? 'passage' : 'word';
}

const topLevelGroups = (groups: StudyGroup[]) => groups.filter((g) => !g.parentId);
const childGroups = (groups: StudyGroup[], parentId: string) => groups.filter((g) => g.parentId === parentId);

function studyDisplayRef(study: Study): string {
  return studyKind(study) === 'passage' && study.passageRef
    ? formatPassageRef(study.passageRef)
    : formatRef(study.verseRef);
}

const GROUP_COLORS = ['#C9954A','#4A7FA5','#5A8A6E','#A84848','#8B6F9B','#4A8FA5'];

interface LibraryProps {
  onOpen: (verseRef: string) => void;
  onOpenReflection?: (study: Study) => void;
  onClose: () => void;
  onHome: () => void;
  onLibrary: () => void;
  onMemoryVerses: () => void;
  signedIn: boolean;
  onSignIn: () => void;
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

export function Library({ onOpen, onOpenReflection, onClose, onHome, onLibrary, onMemoryVerses, signedIn, onSignIn }: LibraryProps) {
  const [studies, setStudies] = useState<Study[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [groupFilter, setGroupFilter] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [subParentId, setSubParentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bookFilter, setBookFilter] = useState('');
  const [wordsFilter, setWordsFilter] = useState('');
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEscToClose(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();

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
    const parent = subParentId ? groups.find((g) => g.id === subParentId) : null;
    const group: StudyGroup = {
      id: crypto.randomUUID(),
      name,
      // Sub-groups inherit the parent's color so they read as a family
      color: parent ? parent.color : GROUP_COLORS[topLevelGroups(groups).length % GROUP_COLORS.length],
      createdAt: Date.now(),
      parentId: subParentId ?? null,
    };
    await saveGroup(group);
    setGroups((prev) => [...prev, group]);
    setNewGroupName('');
    setSubParentId(null);
    showToast(`${parent ? 'Sub-group' : 'Group'} “${group.name}” created ✓`);
    // keep the manager open so several groups can be added in a row
  };

  const handleDeleteGroup = async (id: string) => {
    // Deleting a parent also removes its sub-groups
    const ids = [id, ...childGroups(groups, id).map((g) => g.id)];
    await Promise.all(ids.map((gid) => deleteGroup(gid)));
    const affected = studies.filter((s) => s.groupId && ids.includes(s.groupId));
    await Promise.all(affected.map((s) => saveStudy({ ...s, groupId: null })));
    setStudies((prev) => prev.map((s) => (s.groupId && ids.includes(s.groupId)) ? { ...s, groupId: null } : s));
    setGroups((prev) => prev.filter((g) => !ids.includes(g.id)));
    if (ids.includes(groupFilter)) setGroupFilter('');
    if (subParentId && ids.includes(subParentId)) setSubParentId(null);
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

  const counts = useMemo(() => {
    let word = 0, passage = 0;
    studies.forEach((s) => { if (studyKind(s) === 'passage') passage++; else word++; });
    return { all: studies.length, word, passage };
  }, [studies]);

  const filtered = useMemo(() => {
    return studies.filter((s) => {
      if (kindFilter !== 'all' && studyKind(s) !== kindFilter) return false;
      if (bookFilter && getBookFromRef(s.verseRef) !== bookFilter) return false;
      if (wordsFilter && s.focusStrongs !== wordsFilter) return false;
      if (groupFilter) {
        if (groupFilter === '__none__') {
          if (s.groupId) return false;
        } else {
          // A parent group also matches studies in its sub-groups
          const allowed = new Set([groupFilter, ...childGroups(groups, groupFilter).map((g) => g.id)]);
          if (!s.groupId || !allowed.has(s.groupId)) return false;
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
  }, [studies, search, bookFilter, wordsFilter, groupFilter, kindFilter, groups]);

  const handleOpen = (study: Study) => {
    if (studyKind(study) === 'passage' && onOpenReflection) {
      onOpenReflection(study);
    } else {
      onOpen(study.verseRef);
    }
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
      <div className="library-panel" ref={trapRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Study library">
        <OverlayNav current="library" onHome={onHome} onLibrary={onLibrary} onMemoryVerses={onMemoryVerses} />
        <div className="library-header">
          <button className="library-back" onClick={onClose}>
            ← Back
          </button>
          <h2 className="library-title">My Study Library</h2>
          <div className="library-header-actions">
            <button className="library-action-btn library-action-btn--accent" onClick={() => setShowGroupInput(true)} title="Create a new group">
              + New Group
            </button>
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
                placeholder={subParentId
                  ? `Sub-group under “${groups.find((g) => g.id === subParentId)?.name ?? ''}”…`
                  : 'New group name…'}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                autoFocus
              />
              <button className="library-action-btn" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                {subParentId ? 'Add sub' : 'Create'}
              </button>
              {subParentId && (
                <button className="library-action-btn" onClick={() => setSubParentId(null)}>Cancel</button>
              )}
            </div>
            {groups.length > 0 && (
              <div className="library-group-manager__list">
                {topLevelGroups(groups).map((g) => (
                  <div key={g.id}>
                    <div className="library-group-manager__item">
                      <span className="library-group-manager__dot" style={{ background: g.color }} />
                      <span className="library-group-manager__name">{g.name}</span>
                      <button
                        className="library-group-manager__sub"
                        onClick={() => setSubParentId(g.id)}
                        title={`Add a sub-group under ${g.name}`}
                      >+ Sub-group</button>
                      <button
                        className="library-group-manager__delete"
                        onClick={() => handleDeleteGroup(g.id)}
                        aria-label={`Delete group ${g.name}`}
                      >×</button>
                    </div>
                    {childGroups(groups, g.id).map((c) => (
                      <div key={c.id} className="library-group-manager__item library-group-manager__item--child">
                        <span className="library-group-manager__dot" style={{ background: c.color }} />
                        <span className="library-group-manager__name">↳ {c.name}</span>
                        <button
                          className="library-group-manager__delete"
                          onClick={() => handleDeleteGroup(c.id)}
                          aria-label={`Delete sub-group ${c.name}`}
                        >×</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!signedIn && (
          <div className="library-nudge">
            <SignInNudge onSignIn={onSignIn} what="studies" />
          </div>
        )}

        <div className="library-kinds" role="group" aria-label="Filter by study type">
          {([
            ['all', 'All', counts.all],
            ['word', 'Word', counts.word],
            ['passage', 'Reflection', counts.passage],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              className={`library-kind-tab${kindFilter === value ? ' library-kind-tab--active' : ''}`}
              onClick={() => setKindFilter(value)}
            >
              {label} <span className="library-kind-tab__count">{count}</span>
            </button>
          ))}
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
            {topLevelGroups(groups).map((g) => (
              <Fragment key={g.id}>
                <button
                  className={`library-group-pill${groupFilter === g.id ? ' library-group-pill--active' : ''}`}
                  style={{ '--group-color': g.color } as React.CSSProperties}
                  onClick={() => setGroupFilter(g.id)}
                >
                  <span className="library-group-pill__dot" />
                  {g.name}
                </button>
                {childGroups(groups, g.id).map((c) => (
                  <button
                    key={c.id}
                    className={`library-group-pill library-group-pill--child${groupFilter === c.id ? ' library-group-pill--active' : ''}`}
                    style={{ '--group-color': c.color } as React.CSSProperties}
                    onClick={() => setGroupFilter(c.id)}
                  >
                    <span className="library-group-pill__dot" />
                    {c.name}
                  </button>
                ))}
              </Fragment>
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
  const isPassage = studyKind(study) === 'passage';
  const wordLabel = [study.focusStrongs, study.focusWord].filter(Boolean).join(' ');
  const methodName = isPassage ? getMethod(study.methodId ?? '')?.name : null;
  const currentGroup = groups.find((g) => g.id === study.groupId);
  const [showGroupSelect, setShowGroupSelect] = useState(false);

  return (
    <div className="study-card" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <div className="study-card__top">
        <span className="study-card__ref">{studyDisplayRef(study)}</span>
        <span className="study-card__time">{relativeTime(study.updatedAt)}</span>
      </div>
      <div className="study-card__title">{study.title}</div>
      {methodName && (
        <div className="study-card__method">
          <span className="study-card__kind-tag">Reflection</span>
          {methodName}
        </div>
      )}
      {wordLabel && <div className="study-card__word">{wordLabel}</div>}
      {isPassage && study.passageSnapshot?.text && (
        <div className="study-card__passage-quote">“{study.passageSnapshot.text}”</div>
      )}
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
          {topLevelGroups(groups).map((g) => (
            <Fragment key={g.id}>
              <button
                className={`study-card__group-option${study.groupId === g.id ? ' study-card__group-option--active' : ''}`}
                onClick={() => { onAssignGroup(g.id); setShowGroupSelect(false); }}
              >
                <span className="study-card__group-dot" style={{ background: g.color }} />{g.name}
              </button>
              {childGroups(groups, g.id).map((c) => (
                <button
                  key={c.id}
                  className={`study-card__group-option study-card__group-option--child${study.groupId === c.id ? ' study-card__group-option--active' : ''}`}
                  onClick={() => { onAssignGroup(c.id); setShowGroupSelect(false); }}
                >
                  <span className="study-card__group-dot" style={{ background: c.color }} />↳ {c.name}
                </button>
              ))}
            </Fragment>
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
