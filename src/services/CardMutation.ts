import { createEmptyCard } from 'ts-fsrs';
import type { Card } from 'ts-fsrs';
import { execute } from '../db';
import type { CardInput, ICardMutation } from './types';

function uid() { return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2); }

const ex = (sql: string, args: (string | number | null)[] = []) => execute(sql, args);
const one = async <T>(sql: string, args?: (string | number)[]) => ex(sql, args).then(r => (r.rows[0] as T) ?? null);

export class CardMutation implements ICardMutation {
  async addCards(deckName: string, source: string, cards: CardInput[]): Promise<number> {
    const deckId = uid(); const now = new Date().toISOString();
    await ex('INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?,?,?,?)', [deckId, deckName, source, now]);
    let n = 0;
    for (const c of cards) {
      const fsrs = createEmptyCard();
      await ex('INSERT INTO cards (id,deck_id,question,answer,tags,category,created_at,fsrs_due,fsrs_stability,fsrs_difficulty,fsrs_elapsed_days,fsrs_scheduled_days,fsrs_reps,fsrs_lapses,fsrs_state,fsrs_last_review,fsrs_learning_steps) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [uid(), deckId, c.question, c.answer, JSON.stringify(c.tags || []), c.category || '', now, fsrs.due.toISOString(), fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, null, fsrs.learning_steps]);
      n++;
    }
    return n;
  }

  async updateCardFSRS(id: string, fsrs: Card) {
    await ex('UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
      [fsrs.due.toISOString(), fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, fsrs.last_review?.toISOString() ?? null, fsrs.learning_steps, id]);
  }

  async insertReviewLog(cid: string, rating: number, result: { card: Card; log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date } }) {
    await ex('INSERT INTO review_logs (card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [cid, rating, result.card.state, result.card.due.toISOString(), result.card.stability, result.card.difficulty, result.log.elapsed_days, result.log.last_elapsed_days, result.log.scheduled_days, result.log.learning_steps, result.log.review.toISOString()]);
  }

  async recordReview(id: string, fsrs: Card, rating: number, result: { card: Card; log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date } }) {
    // Fire both writes concurrently — single await
    await Promise.all([
      ex('UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
        [fsrs.due.toISOString(), fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, fsrs.last_review?.toISOString() ?? null, fsrs.learning_steps, id]),
      ex('INSERT INTO review_logs (card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [id, rating, result.card.state, result.card.due.toISOString(), result.card.stability, result.card.difficulty, result.log.elapsed_days, result.log.last_elapsed_days, result.log.scheduled_days, result.log.learning_steps, result.log.review.toISOString()]),
    ]);
  }

  async deleteCard(id: string) { await ex('DELETE FROM review_logs WHERE card_id = ?', [id]); await ex('DELETE FROM cards WHERE id = ?', [id]); }

  async deleteCardsByDeck(name: string) {
    const r = await one<{ id: string }>('SELECT id FROM decks WHERE name = ?', [name]);
    if (!r) return 0;
    await ex('DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)', [r.id]);
    await ex('DELETE FROM cards WHERE deck_id = ?', [r.id]);
    await ex('DELETE FROM decks WHERE id = ?', [r.id]);
    return 1;
  }

  async undoReview(id: string, prev: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number }) {
    await ex('UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
      [prev.due.toISOString(), prev.stability, prev.difficulty, prev.elapsed_days, prev.scheduled_days, prev.reps, prev.lapses, prev.state, prev.last_review?.toISOString() ?? null, prev.learning_steps, id]);
    await ex('DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', [id]);
  }

  async togglePauseCategory(cat: string) {
    const r = await one<{ value: string }>("SELECT value FROM settings WHERE key = 'paused_categories'");
    let p: string[] = [];
    try { p = JSON.parse(r?.value || '[]'); } catch {}
    const i = p.indexOf(cat);
    if (i >= 0) p.splice(i, 1); else p.push(cat);
    await ex("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused_categories', ?)", [JSON.stringify(p)]);
  }
}
