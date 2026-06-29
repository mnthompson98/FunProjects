import { useState } from 'react';
import { signInWithProvider, sendMagicLink } from '../../lib/supabase';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [showEmail, setShowEmail] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const handleGoogle = async () => {
    setErrorMsg('');
    setRedirecting(true);
    const { error } = await signInWithProvider('google');
    if (error) {
      setErrorMsg(error);
      setRedirecting(false);
    }
    // On success the browser redirects to Google — nothing else to do.
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    const { error } = await sendMagicLink(email.trim());
    if (error) {
      setErrorMsg(error);
      setStatus('error');
    } else {
      setStatus('sent');
    }
  };

  return (
    <div
      className="auth-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal__close" onClick={onClose} aria-label="Close">×</button>

        {status === 'sent' ? (
          <div className="auth-modal__sent">
            <div className="auth-modal__sent-icon">✓</div>
            <h2>Check your email</h2>
            <p>
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no
              password needed.
            </p>
            <button className="auth-modal__btn auth-modal__btn--secondary" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2 className="auth-modal__title">Sign in to Verse Roots</h2>
            <p className="auth-modal__subtitle">Use your Google account — no password to remember.</p>

            <div className="auth-modal__providers">
              <button
                className="auth-provider-btn"
                onClick={handleGoogle}
                disabled={redirecting}
              >
                <span className="auth-provider-btn__icon" aria-hidden="true">{GoogleIcon}</span>
                {redirecting ? 'Redirecting…' : 'Continue with Google'}
              </button>
            </div>

            {errorMsg && <p className="auth-modal__error">{errorMsg}</p>}

            {!showEmail ? (
              <button className="auth-modal__email-toggle" onClick={() => setShowEmail(true)}>
                or sign in with email
              </button>
            ) : (
              <form onSubmit={handleEmailSubmit} className="auth-modal__form">
                <label htmlFor="auth-email" className="auth-modal__label">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  className="auth-modal__input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={status === 'sending'}
                />
                <button
                  type="submit"
                  className="auth-modal__btn auth-modal__btn--primary"
                  disabled={status === 'sending' || !email.trim()}
                >
                  {status === 'sending' ? 'Sending…' : 'Send magic link'}
                </button>
              </form>
            )}

            <p className="auth-modal__fine-print">
              Signing in syncs your studies, reflections, groups, and memory verses across all your
              devices. Your library is always saved on this device too.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const GoogleIcon = (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
  </svg>
);

