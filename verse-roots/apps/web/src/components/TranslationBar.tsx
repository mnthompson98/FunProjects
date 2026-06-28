import type { ReactNode } from 'react';
import { TRANSLATIONS } from '../utils/translations';

interface TranslationBarProps {
  value: string;
  onChange: (t: string) => void;
  children?: ReactNode; // optional trailing content (e.g. external links)
}

/** Shared "Translation: [pills]" selector used across the reading views. */
export function TranslationBar({ value, onChange, children }: TranslationBarProps) {
  return (
    <div className="translation-bar">
      <span className="translation-label">Translation:</span>
      <div className="translation-pills" role="group" aria-label="Translation">
        {TRANSLATIONS.map((t) => (
          <button
            key={t}
            className={`translation-pill${value === t ? ' translation-pill--active' : ''}`}
            onClick={() => onChange(t)}
          >{t}</button>
        ))}
      </div>
      {children}
    </div>
  );
}
