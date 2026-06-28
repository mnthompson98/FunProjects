// Minimal global toast bus — call showToast() from anywhere, render with <Toaster/>.

export interface ToastMsg {
  id: number;
  message: string;
}

type Listener = (t: ToastMsg) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function showToast(message: string): void {
  counter += 1;
  const toast = { id: counter, message };
  listeners.forEach((l) => l(toast));
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
