import { useEffect, useState } from 'react';
import './FontSizeControl.css';

const KEY = 'vr-read-scale';
const STEPS = [0.9, 1, 1.15, 1.3];

function initialIndex(): number {
  const v = parseFloat(localStorage.getItem(KEY) || '1');
  const i = STEPS.indexOf(v);
  return i >= 0 ? i : 1;
}

export function FontSizeControl() {
  const [idx, setIdx] = useState(initialIndex);

  useEffect(() => {
    document.documentElement.style.setProperty('--read-scale', String(STEPS[idx]));
    try { localStorage.setItem(KEY, String(STEPS[idx])); } catch { /* ignore */ }
  }, [idx]);

  return (
    <div className="fontsize-control" role="group" aria-label="Reading text size">
      <button
        className="fontsize-control__btn"
        onClick={() => setIdx((i) => Math.max(0, i - 1))}
        disabled={idx === 0}
        aria-label="Smaller reading text"
      >A<span className="fontsize-control__minus">−</span></button>
      <button
        className="fontsize-control__btn"
        onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))}
        disabled={idx === STEPS.length - 1}
        aria-label="Larger reading text"
      >A<span className="fontsize-control__plus">+</span></button>
    </div>
  );
}
