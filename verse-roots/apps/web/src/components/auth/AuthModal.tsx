import { useState } from 'react';
import { sendMagicLink } from '../../lib/supabase';
import './AuthModal.css';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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
        <button className="auth-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {status === 'sent' ? (
          <div className="auth-modal__sent">
            <div className="auth-modal__sent-icon">✓</div>
            <h2>Check your email</h2>
            <p>
              We sent a magic link to <strong>{email}</strong>. Click it to sign in — no
              password needed.
            </p>
            <button className="auth-modal__btn auth-modal__btn--secondary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="auth-modal__title">Sign in to Verse Roots</h2>
            <p className="auth-modal__subtitle">
              Enter your email and we'll send you a magic link. No password required.
            </p>
            <form onSubmit={handleSubmit} className="auth-modal__form">
              <label htmlFor="auth-email" className="auth-modal__label">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                className="auth-modal__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                required
                disabled={status === 'sending'}
              />
              {status === 'error' && <p className="auth-modal__error">{errorMsg}</p>}
              <button
                type="submit"
                className="auth-modal__btn auth-modal__btn--primary"
                disabled={status === 'sending' || !email.trim()}
              >
                {status === 'sending' ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
            <p className="auth-modal__fine-print">
              Signing in enables cloud sync across devices ($7/mo Pro plan). Your local
              studies are always saved for free.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
