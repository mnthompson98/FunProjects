import type { User, SubscriptionStatus } from '../lib/supabase';
import { signOut } from '../lib/supabase';
import { UserMenu } from './auth/UserMenu';
import './Header.css';

interface HeaderProps {
  onOpenLibrary: () => void;
  user: User | null;
  subscriptionStatus: SubscriptionStatus;
  onOpenAuth: () => void;
  onOpenAccount: () => void;
  onSync: () => void;
}

export function Header({
  onOpenLibrary,
  user,
  subscriptionStatus,
  onOpenAuth,
  onOpenAccount,
  onSync,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <h1 className="header-title">Verse Roots</h1>
          <p className="header-tagline">Explore the original languages of Scripture</p>
        </div>
        <div className="header-actions">
          <button className="header-library-btn" onClick={onOpenLibrary}>
            Library
          </button>
          {user ? (
            <UserMenu
              user={user}
              canSync={subscriptionStatus.canSync}
              onSync={onSync}
              onOpenAccount={onOpenAccount}
              onSignOut={signOut}
            />
          ) : (
            <button className="header-signin-btn" onClick={onOpenAuth}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
