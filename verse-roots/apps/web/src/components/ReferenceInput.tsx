import { useRef, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { getSearchHistory, addSearchHistory } from '../utils/recent';
import './ReferenceInput.css';

const BOOKS = [
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

interface ReferenceInputProps {
  onSubmit: (ref: string) => void;
  loading: boolean;
  error: string | null;
}

export function ReferenceInput({ onSubmit, loading, error }: ReferenceInputProps) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (raw: string) => {
    const ref = raw.trim();
    if (!ref) return;
    addSearchHistory(ref);
    inputRef.current?.blur(); // iOS releases zoom after submit
    setOpen(false);
    onSubmit(ref);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(value);
  };

  // Suggestions: book-name matches while typing, recent searches when empty
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) {
      return getSearchHistory().slice(0, 6).map((s) => ({ kind: 'history' as const, text: s }));
    }
    // match the leading book token (everything before a digit)
    const bookPart = q.replace(/\s*\d.*$/, '').trim();
    if (!bookPart) return [];
    return BOOKS
      .filter((b) => b.toLowerCase().startsWith(bookPart) || b.toLowerCase().includes(bookPart))
      .slice(0, 6)
      .map((b) => ({ kind: 'book' as const, text: b }));
  }, [value]);

  const pickSuggestion = (s: { kind: 'history' | 'book'; text: string }) => {
    if (s.kind === 'history') {
      submit(s.text);
    } else {
      // fill the book and let the user add chapter:verse
      const filled = `${s.text} `;
      setValue(filled);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="reference-input-container">
      <form className="reference-form" onSubmit={handleSubmit} autoComplete="off">
        <div className="reference-input-wrap">
          <input
            ref={inputRef}
            className="reference-input"
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="e.g. John 3:16  ·  John 3  ·  Psalm 23:1"
            aria-label="Bible reference"
            disabled={loading}
          />
          {open && suggestions.length > 0 && (
            <ul className="reference-suggestions">
              {suggestions.map((s) => (
                <li key={`${s.kind}-${s.text}`}>
                  <button
                    type="button"
                    className="reference-suggestion"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                  >
                    {s.kind === 'history' && <span className="reference-suggestion__icon">↻</span>}
                    {s.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="reference-submit" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Go'}
        </button>
      </form>
      {error && <p className="reference-error">{error}</p>}
    </div>
  );
}
