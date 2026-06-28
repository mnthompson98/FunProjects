import { useCallback, useEffect, useRef, useState } from 'react';
import type { Study, StudySection, ReflectionSelection } from '../study/types';
import { STUDY_METHODS, getMethod } from '../study/methods';
import { saveStudy, deleteStudy } from '../study/db';
import { formatPassageRef } from '../utils/formatRef';
import { OverlayNav } from './OverlayNav';
import { useEscToClose } from '../hooks/useEscToClose';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './ReflectionPanel.css';

const DEFAULT_METHOD = 'four-rs';

interface ReflectionPanelProps {
  selection?: ReflectionSelection; // new reflection
  existing?: Study;                // reopened from library
  onClose: () => void;
  onSaved?: (study: Study) => void;
  onHome: () => void;
  onLibrary: () => void;
  onMemoryVerses: () => void;
}

function sectionsForMethod(methodId: string): StudySection[] {
  const method = getMethod(methodId);
  return (method?.sections ?? []).map((s) => ({ id: s.id, label: s.label, content: '' }));
}

function createReflection(selection: ReflectionSelection, methodId: string): Study {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    verseRef: selection.startVerseRef,
    title: formatPassageRef(selection.passageRef),
    focusStrongs: null,
    focusWord: null,
    sections: sectionsForMethod(methodId),
    createdAt: now,
    updatedAt: now,
    tags: [],
    kind: 'passage',
    methodId,
    passageRef: selection.passageRef,
    passageSnapshot: selection.snapshot,
  };
}

export function ReflectionPanel({ selection, existing, onClose, onSaved, onHome, onLibrary, onMemoryVerses }: ReflectionPanelProps) {
  const [study, setStudy] = useState<Study>(() =>
    existing ?? createReflection(selection!, DEFAULT_METHOD),
  );
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEscToClose(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studyRef = useRef(study);
  const dirtyRef = useRef(false);
  const persistedRef = useRef(Boolean(existing));

  useEffect(() => { studyRef.current = study; }, [study]);

  const method = getMethod(study.methodId ?? DEFAULT_METHOD);

  const triggerAutosave = useCallback((updated: Study) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSaveStatus('saving');
    debounceTimer.current = setTimeout(async () => {
      try {
        await saveStudy(updated);
        persistedRef.current = true;
        setSaveStatus('saved');
        onSaved?.(updated);
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 800);
  }, [onSaved]);

  // Flush a pending save on unmount so closing never loses the last keystrokes
  useEffect(() => {
    return () => {
      if (debounceTimer.current && dirtyRef.current) {
        clearTimeout(debounceTimer.current);
        saveStudy(studyRef.current).catch(() => {});
      }
    };
  }, []);

  const commit = useCallback((updated: Study) => {
    dirtyRef.current = true;
    studyRef.current = updated;
    setStudy(updated);
    triggerAutosave(updated);
  }, [triggerAutosave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    commit({ ...study, title: e.target.value, updatedAt: Date.now() });
  };

  const handleSectionChange = (sectionId: string, content: string) => {
    commit({
      ...study,
      updatedAt: Date.now(),
      sections: study.sections.map((s) => (s.id === sectionId ? { ...s, content } : s)),
    });
  };

  const handleMethodChange = (methodId: string) => {
    if (methodId === study.methodId) return;
    const hasContent = study.sections.some((s) => s.content.trim());
    if (hasContent && !window.confirm('Switch method? Your notes for this reflection will be cleared.')) {
      return;
    }
    const updated: Study = {
      ...study,
      methodId,
      sections: sectionsForMethod(methodId),
      updatedAt: Date.now(),
    };
    // Only persist the switch if this reflection was already saved
    if (persistedRef.current) commit(updated);
    else { studyRef.current = updated; setStudy(updated); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this reflection? This cannot be undone.')) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    dirtyRef.current = false;
    if (persistedRef.current) await deleteStudy(study.id);
    onClose();
  };

  return (
    <div className="reflection-overlay" onClick={onClose}>
      <div className="reflection-panel" ref={trapRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Reflection editor">
        <OverlayNav current="reflection" onHome={onHome} onLibrary={onLibrary} onMemoryVerses={onMemoryVerses} />
        <div className="reflection-panel__header">
          <div className="reflection-panel__heading">
            <span className="reflection-panel__kind">Reflection</span>
            <h2 className="reflection-panel__ref">{formatPassageRef(study.passageRef ?? study.verseRef)}</h2>
          </div>
          <button className="reflection-panel__close" onClick={onClose} aria-label="Close reflection">×</button>
        </div>

        <div className="reflection-panel__body">
          {study.passageSnapshot?.text && (
            <blockquote className="reflection-panel__quote">"{study.passageSnapshot.text}"</blockquote>
          )}

          <input
            className="reflection-panel__title"
            value={study.title}
            onChange={handleTitleChange}
            aria-label="Reflection title"
            placeholder="Reflection title"
          />

          <div className="reflection-panel__methods" role="group" aria-label="Study method">
            {STUDY_METHODS.map((m) => (
              <button
                key={m.id}
                className={`reflection-method${study.methodId === m.id ? ' reflection-method--active' : ''}`}
                onClick={() => handleMethodChange(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>

          {method?.blurb && <p className="reflection-panel__blurb">{method.blurb}</p>}

          {method?.infoCard && (
            <div className="reflection-panel__info">{method.infoCard}</div>
          )}

          <div className="reflection-panel__sections">
            {study.sections.map((section, idx) => {
              const hint = method?.sections.find((s) => s.id === section.id)?.hint;
              return (
                <ReflectionSectionField
                  key={section.id}
                  index={idx + 1}
                  label={section.label}
                  hint={hint}
                  value={section.content}
                  onChange={(v) => handleSectionChange(section.id, v)}
                />
              );
            })}
          </div>

          {method && (
            <p className="reflection-panel__attribution">
              {method.attribution}{' '}
              <a href={method.sourceUrl} target="_blank" rel="noopener noreferrer">Source ↗</a>
            </p>
          )}
        </div>

        <div className="reflection-panel__footer">
          <span className={`reflection-panel__status${saveStatus !== 'idle' ? ' reflection-panel__status--on' : ''}`}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved ✓'}
            {saveStatus === 'idle' && (persistedRef.current ? 'Autosaved ✓' : '')}
          </span>
          <div className="reflection-panel__footer-actions">
            {persistedRef.current && (
              <button className="reflection-panel__btn reflection-panel__btn--danger" onClick={handleDelete}>Delete</button>
            )}
            <button className="reflection-panel__btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  index: number;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}

function ReflectionSectionField({ index, label, hint, value, onChange }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { autoResize(); }, [autoResize]);

  return (
    <div className="reflection-field">
      <label className="reflection-field__label">
        <span className="reflection-field__index">{index}</span>
        {label}
      </label>
      <textarea
        ref={ref}
        className="reflection-field__textarea"
        rows={2}
        value={value}
        placeholder={hint}
        onChange={(e) => { onChange(e.target.value); autoResize(); }}
        onInput={autoResize}
      />
    </div>
  );
}
