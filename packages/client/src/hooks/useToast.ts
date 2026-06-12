import { useState, useCallback, useEffect } from 'react';

let toastId = 0;
let globalToast: ((msg: string) => void) | null = null;

/** Call from anywhere to show a toast */
export function toast(msg: string) {
  globalToast?.(msg);
}

export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  const doToast = useCallback((msg: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2000);
  }, []);

  useEffect(() => {
    globalToast = doToast;
    return () => { globalToast = null; };
  }, [doToast]);

  return { toasts, toast: doToast };
}
