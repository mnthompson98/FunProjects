import { useState } from 'react';
import './AddMemoryButton.css';

interface AddMemoryButtonProps {
  onAdd: () => Promise<'added' | 'exists'>;
  label: string;
}

export function AddMemoryButton({ onAdd, label }: AddMemoryButtonProps) {
  const [status, setStatus] = useState<'idle' | 'added' | 'exists'>('idle');

  const handleClick = async () => {
    const result = await onAdd();
    setStatus(result);
  };

  return (
    <button
      className={`add-memory-btn${status !== 'idle' ? ' add-memory-btn--done' : ''}`}
      onClick={handleClick}
      disabled={status === 'added'}
    >
      {status === 'added' ? '✓ Added to Memory' : status === 'exists' ? 'Already in Memory' : `★ ${label}`}
    </button>
  );
}
