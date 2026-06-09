import { useState, useRef, useEffect } from 'react';
import type { User } from '../../lib/supabase';
import './UserMenu.css';

interface UserMenuProps {
  user: User;
  canSync: boolean;
  onSync: () => void;
  onOpenAccount: () => void;
  onSignOut: () => void;
}

export function UserMenu({ user, canSync, onSync, onOpenAccount, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initial = (user.email ?? '?')[0].toUpperCase();

  const handleSync = () => {
    setOpen(false);
    onSync();
  };
  const handleAccount = () => {
    setOpen(false);
    onOpenAccount();
  };
  const handleSignOut = () => {
    setOpen(false);
    onSignOut();
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title={user.email ?? 'Account'}
      >
        <span className="user-menu__avatar">{initial}</span>
        <span className="user-menu__email">{user.email}</span>
        <span className="user-menu__caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="user-menu__dropdown">
          <div className="user-menu__plan-badge">
            {canSync ? 'Pro' : 'Free'}
          </div>
          {canSync && (
            <button className="user-menu__item" onClick={handleSync}>
              Sync studies
            </button>
          )}
          <button className="user-menu__item" onClick={handleAccount}>
            {canSync ? 'Manage subscription' : 'Upgrade to Pro'}
          </button>
          <div className="user-menu__divider" />
          <button className="user-menu__item user-menu__item--danger" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
