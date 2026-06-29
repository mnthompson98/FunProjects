import './SignInNudge.css';

interface SignInNudgeProps {
  onSignIn: () => void;
  /** Optional context line, e.g. "memory verses". */
  what?: string;
}

/** A subtle prompt to sign in for cross-device sync. Shown only when signed out. */
export function SignInNudge({ onSignIn, what = 'library' }: SignInNudgeProps) {
  return (
    <div className="signin-nudge">
      <span className="signin-nudge__icon" aria-hidden="true">☁</span>
      <span className="signin-nudge__text">Sign in to sync your {what} across devices.</span>
      <button className="signin-nudge__btn" onClick={onSignIn}>Sign in</button>
    </div>
  );
}
