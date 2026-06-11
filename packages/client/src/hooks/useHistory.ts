import { useRef, useState, useCallback } from 'react';

export interface HistoryEntry {
  cardId: string;
  rating: number;
  prevFSRS: {
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    last_review?: Date;
    learning_steps: number;
  };
}

/**
 * Session review history. Ref = no stale closures, state = trigger re-render.
 */
export function useHistory() {
  const stackRef = useRef<HistoryEntry[]>([]);
  const [length, setLength] = useState(0);

  const push = useCallback((entry: HistoryEntry) => {
    stackRef.current = [...stackRef.current, entry];
    setLength(stackRef.current.length);
  }, []);

  const pop = useCallback((): HistoryEntry | null => {
    const s = stackRef.current;
    if (s.length === 0) return null;
    const last = s[s.length - 1];
    stackRef.current = s.slice(0, -1);
    setLength(stackRef.current.length);
    return last;
  }, []);

  return { stackRef, length, push, pop };
}
