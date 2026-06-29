import { useState } from 'react';
import { FontSizeControl } from './FontSizeControl';
import './Header.css';

interface HeaderProps {
  onOpenLibrary: () => void;
  onOpenMemoryVerses: () => void;
  userEmail: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({ onOpenLibrary, onOpenMemoryVerses, userEmail, onSignIn, onSignOut }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <h1 className="header-title">Verse Roots</h1>
          <p className="header-tagline">Explore the original languages of Scripture</p>
        </div>
        <div className="header-actions">
          <FontSizeControl />
          <button className="header-library-btn" onClick={onOpenMemoryVerses}>
            Memory Verses
          </button>
          <button className="header-library-btn" onClick={onOpenLibrary}>
            Library
          </button>
          {userEmail ? (
            <div className="header-account">
              <button
                className="header-account__chip"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account"
                title={userEmail}
              >
                {userEmail[0]?.toUpperCase() ?? '·'}
              </button>
              {menuOpen && (
                <>
                  <div className="header-account__backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="header-account__menu">
                    <span className="header-account__email">{userEmail}</span>
                    <button
                      className="header-account__signout"
                      onClick={() => { setMenuOpen(false); onSignOut(); }}
                    >Sign out</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="header-library-btn header-signin-btn" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
