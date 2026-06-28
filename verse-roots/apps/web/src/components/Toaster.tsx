import { useEffect, useState } from 'react';
import { subscribeToast, type ToastMsg } from '../utils/toast';
import './Toaster.css';

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    return subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 2400);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.message}</div>
      ))}
    </div>
  );
}
