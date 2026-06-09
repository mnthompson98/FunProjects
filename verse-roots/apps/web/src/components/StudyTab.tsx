import { useState, useEffect, useRef, useCallback } from 'react';
import type { Study, StudySection } from '../study/types';
import { STUDY_TEMPLATE } from '../study/types';
import { saveStudy, getStudiesByVerse, deleteStudy } from '../study/db';
import { formatRef } from '../utils/formatRef';
import './StudyTab.css';

export interface StudyTabProps {
  verseRef: string;
  focusStrongs: string | null;
  focusWord: string | null;
  focusLemma: string | null;
  onStudySaved?: (study: Study) => void;
}

function createBlankStudy(
  verseRef: string,
  focusStrongs: string | null,
  focusWord: string | null,
): Study {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    verseRef,
    title: formatRef(verseRef),
    focusStrongs,
    focusWord,
    sections: STUDY_TEMPLATE.map((s) => ({ ...s })),
    createdAt: now,
    updatedAt: now,
    tags: [],
  };
}

export function StudyTab({
  verseRef,
  focusStrongs,
  focusWord,
  focusLemma,
  onStudySaved,
}: StudyTabProps) {
  const [study, setStudy] = useState<Study>(() =>
    createBlankStudy(verseRef, focusStrongs, focusWord),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([STUDY_TEMPLATE[0].id]),
  );
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPersisted = useRef(false);

  // Load existing studies when verseRef changes
  useEffect(() => {
    let cancelled = false;
    hasPersisted.current = false;
    setIsDirty(false);
    setSaveStatus('idle');
    setExpandedSections(new Set([STUDY_TEMPLATE[0].id]));

    getStudiesByVerse(verseRef).then((studies) => {
      if (cancelled) return;
      if (studies.length > 0) {
        setStudy(studies[0]);
        hasPersisted.current = true;
      } else {
        setStudy(createBlankStudy(verseRef, focusStrongs, focusWord));
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseRef]);

  const triggerAutosave = useCallback(
    (updatedStudy: Study) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setSaveStatus('saving');
      debounceTimer.current = setTimeout(async () => {
        try {
          await saveStudy(updatedStudy);
          hasPersisted.current = true;
          setSaveStatus('saved');
          onStudySaved?.(updatedStudy);
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          fadeTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
          setSaveStatus('idle');
        }
      }, 800);
    },
    [onStudySaved],
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated: Study = { ...study, title: e.target.value, updatedAt: Date.now() };
    setStudy(updated);
    setIsDirty(true);
    triggerAutosave(updated);
  };

  const handleSectionChange = (sectionId: string, content: string) => {
    const updated: Study = {
      ...study,
      updatedAt: Date.now(),
      sections: study.sections.map((s) =>
        s.id === sectionId ? { ...s, content } : s,
      ),
    };
    setStudy(updated);
    if (!isDirty) setIsDirty(true);
    triggerAutosave(updated);
  };

  const handleNewStudy = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    hasPersisted.current = false;
    setIsDirty(false);
    setSaveStatus('idle');
    setExpandedSections(new Set([STUDY_TEMPLATE[0].id]));
    setStudy(createBlankStudy(verseRef, focusStrongs, focusWord));
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this study? This cannot be undone.')) return;
    if (hasPersisted.current) {
      await deleteStudy(study.id);
    }
    handleNewStudy();
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const subtitle = [
    focusStrongs,
    focusLemma ?? focusWord,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="study-tab">
      <div className="study-tab__meta">
        <input
          className="study-tab__title-input"
          value={study.title}
          onChange={handleTitleChange}
          aria-label="Study title"
          placeholder="Study title"
        />
        <div className="study-tab__subtitle">
          {formatRef(verseRef)}
          {subtitle && <span className="study-tab__subtitle-word"> · {subtitle}</span>}
        </div>
      </div>

      <div className="study-tab__sections">
        {study.sections.map((section, idx) => (
          <AccordionSection
            key={section.id}
            section={section}
            index={idx + 1}
            expanded={expandedSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
            onChange={(content) => handleSectionChange(section.id, content)}
          />
        ))}
      </div>

      <div className="study-tab__footer">
        <div className="study-tab__status-row">
          <span
            className={`study-tab__save-status ${saveStatus === 'saved' ? 'study-tab__save-status--saved' : ''} ${saveStatus === 'saving' ? 'study-tab__save-status--saving' : ''}`}
          >
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved ✓'}
            {saveStatus === 'idle' && (hasPersisted.current ? 'Autosaved ✓' : ' ')}
          </span>
        </div>
        <div className="study-tab__footer-actions">
          <button
            className="study-tab__btn study-tab__btn--danger"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button className="study-tab__btn" onClick={handleNewStudy}>
            New
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccordionSectionProps {
  section: StudySection;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (content: string) => void;
}

function AccordionSection({
  section,
  index,
  expanded,
  onToggle,
  onChange,
}: AccordionSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (expanded) {
      // Small delay to let display:block take effect before measuring
      requestAnimationFrame(autoResize);
    }
  }, [expanded, autoResize]);

  return (
    <div className={`study-section ${expanded ? 'study-section--expanded' : ''}`}>
      <button
        className="study-section__header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="study-section__index">{index}.</span>
        <span className="study-section__label">{section.label}</span>
        <span className="study-section__arrow">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="study-section__body">
          <textarea
            ref={textareaRef}
            className="study-section__textarea"
            rows={3}
            value={section.content}
            placeholder={`Write your ${section.label.toLowerCase()} notes here…`}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize();
            }}
            onInput={autoResize}
          />
        </div>
      )}
    </div>
  );
}

