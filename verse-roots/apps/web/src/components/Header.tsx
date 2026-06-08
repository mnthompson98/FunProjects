import './Header.css';

interface HeaderProps {
  onOpenLibrary: () => void;
}

export function Header({ onOpenLibrary }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <h1 className="header-title">Verse Roots</h1>
          <p className="header-tagline">Explore the original languages of Scripture</p>
        </div>
        <button className="header-library-btn" onClick={onOpenLibrary}>
          Library
        </button>
      </div>
    </header>
  );
}
