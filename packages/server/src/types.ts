import { State } from 'ts-fsrs';
import db from './db';

// ─── Types ──────────────────────────────────

export interface Flashcard {
  id: string; deckId: string; deck: string;
  question: string; answer: string; tags: string[]; category: string;
  createdAt: string;
  fsrs: {
    due: Date; stability: number; difficulty: number; elapsed_days: number;
    scheduled_days: number; reps: number; lapses: number; state: number;
    last_review?: Date; learning_steps: number;
  };
}

export function rowToCard(r: Record<string, unknown>, deckName?: string): Flashcard {
  return {
    id: r['id'] as string, deckId: r['deck_id'] as string,
    deck: (deckName || r['deck_name'] || '') as string,
    question: r['question'] as string, answer: r['answer'] as string,
    tags: JSON.parse((r['tags'] as string) || '[]'),
    category: (r['category'] as string) || '',
    createdAt: r['created_at'] as string,
    fsrs: {
      due: new Date(r['fsrs_due'] as string), stability: r['fsrs_stability'] as number,
      difficulty: r['fsrs_difficulty'] as number, elapsed_days: r['fsrs_elapsed_days'] as number,
      scheduled_days: r['fsrs_scheduled_days'] as number, reps: r['fsrs_reps'] as number,
      lapses: r['fsrs_lapses'] as number, state: r['fsrs_state'] as number,
      last_review: r['fsrs_last_review'] ? new Date(r['fsrs_last_review'] as string) : undefined,
      learning_steps: r['fsrs_learning_steps'] as number,
    },
  };
}

// ─── DB Helpers ─────────────────────────────

export const one = (sql: string, args: (string | number)[] = []) =>
  db.execute({ sql, args }).then(r => r.rows[0] ?? null);

export const all = (sql: string, args: (string | number)[] = []) =>
  db.execute({ sql, args }).then(r => r.rows as unknown as Record<string, unknown>[]);

export async function getDueCardsRaw(category?: string, excludePaused?: string[], deckId?: string) {
  const c = [`(c.fsrs_state = ${State.New} OR c.fsrs_due <= ?)`];
  const a: (string | number)[] = [new Date().toISOString()];
  if (category) { c.push('c.category = ?'); a.push(category); }
  if (deckId) { c.push('c.deck_id = ?'); a.push(deckId); }
  if (excludePaused?.length) { c.push(`c.category NOT IN (${excludePaused.map(() => '?').join(',')})`); a.push(...excludePaused); }
  const rows = await all(`SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id WHERE ${c.join(' AND ')} ORDER BY c.fsrs_due ASC`, a);
  return rows.map(r => rowToCard(r));
}

export function uid() { return crypto.randomUUID(); }
