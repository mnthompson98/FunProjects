import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './ReferenceInput.css';

interface ReferenceInputProps {
  onSubmit: (ref: string) => void;
  loading: boolean;
  error: string | null;
}

export function ReferenceInput({ onSubmit, loading, error }: ReferenceInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      // Blur so iOS releases zoom after submission
      inputRef.current?.blur();
      onSubmit(value.trim());
    }
  };

  return (
    <div className="reference-input-container">
      <form className="reference-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="reference-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. John 3:16  ·  John 3  ·  Psalm 23:1"
          aria-label="Bible reference"
          disabled={loading}
        />
        <button className="reference-submit" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Go'}
        </button>
      </form>
      {error && <p className="reference-error">{error}</p>}
    </div>
  );
}
