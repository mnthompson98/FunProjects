import './OverlayNav.css';

export type OverlaySection = 'library' | 'memory' | 'reflection';

interface OverlayNavProps {
  current?: OverlaySection;
  onHome: () => void;
  onLibrary: () => void;
  onMemoryVerses: () => void;
}

/**
 * Consistent navigation strip shown at the top of every full-screen overlay so
 * users can always move between Home, Library, and Memory Verses without
 * backing out or reloading.
 */
export function OverlayNav({ current, onHome, onLibrary, onMemoryVerses }: OverlayNavProps) {
  return (
    <nav className="overlay-nav" aria-label="Sections">
      <button className="overlay-nav__btn overlay-nav__home" onClick={onHome}>⌂ Home</button>
      <div className="overlay-nav__sections">
        <button
          className={`overlay-nav__btn${current === 'library' ? ' overlay-nav__btn--active' : ''}`}
          onClick={onLibrary}
        >Library</button>
        <button
          className={`overlay-nav__btn${current === 'memory' ? ' overlay-nav__btn--active' : ''}`}
          onClick={onMemoryVerses}
        >Memory Verses</button>
      </div>
    </nav>
  );
}
