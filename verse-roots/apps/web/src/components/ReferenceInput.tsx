import { useState, FormEvent } from 'react';
import './ReferenceInput.css';

interface ReferenceInputProps {
  onSubmit: (ref: string) => void;
  loading: boolean;
  error: string | null;
}

export function ReferenceInput({ onSubmit, loading, error }: ReferenceInputProps) {
  const [value, setValue] = useState('Lam 3:22');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <div className="reference-input-container">
      <form className="reference-form" onSubmit={handleSubmit}>
        <input
          className="reference-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. John 3:16, Genesis 1:1, Lam 3:22"
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
