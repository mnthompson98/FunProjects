import './Header.css';

interface HeaderProps {
  onOpenLibrary: () => void;
  onOpenMemoryVerses: () => void;
}

export function Header({ onOpenLibrary, onOpenMemoryVerses }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <h1 className="header-title">Verse Roots</h1>
          <p className="header-tagline">Explore the original languages of Scripture</p>
        </div>
        <div className="header-actions">
          <button className="header-library-btn" onClick={onOpenMemoryVerses}>
            Memory Verses
          </button>
          <button className="header-library-btn" onClick={onOpenLibrary}>
            Library
          </button>
        </div>
      </div>
    </header>
  );
}
