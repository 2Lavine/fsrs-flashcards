import type { Database } from 'sql.js';
import { createEmptyCard } from 'ts-fsrs';
import type { ICardMutation } from './ICardMutation';
import type { Flashcard, CardInput } from './types';

function uid(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function bindCard(
  stmt: { bind: (args: (string | number | null)[]) => void },
  card: Flashcard,
): void {
  stmt.bind([
    card.id,
    card.deckId,
    card.question,
    card.answer,
    JSON.stringify(card.tags),
    card.category,
    card.createdAt,
    card.fsrs.due.toISOString(),
    card.fsrs.stability,
    card.fsrs.difficulty,
    card.fsrs.elapsed_days,
    card.fsrs.scheduled_days,
    card.fsrs.reps,
    card.fsrs.lapses,
    card.fsrs.state,
    card.fsrs.last_review?.toISOString() ?? null,
    card.fsrs.learning_steps,
  ]);
}

export class SqlCardMutation implements ICardMutation {
  constructor(private db: Database) {}

  addCards(deckName: string, source: string, cards: CardInput[]): number {
    let deck = this.db.exec('SELECT id FROM decks WHERE name = ?', [deckName]);
    let deckId: string;
    if (deck.length === 0 || deck[0].values.length === 0) {
      deckId = uid();
      this.db.run('INSERT INTO decks (id, name, source, created_at) VALUES (?, ?, ?, ?)', [
        deckId,
        deckName,
        source || '',
        new Date().toISOString(),
      ]);
    } else {
      deckId = deck[0].values[0][0] as string;
      if (source) this.db.run('UPDATE decks SET source = ? WHERE id = ?', [source, deckId]);
    }

    const now = new Date().toISOString();
    const insertCard = this.db.prepare(`
      INSERT INTO cards (id, deck_id, question, answer, tags, category, created_at,
        fsrs_due, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days,
        fsrs_scheduled_days, fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review,
        fsrs_learning_steps)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    for (const c of cards) {
      const fsrsCard = createEmptyCard();
      const card: Flashcard = {
        id: uid(),
        deckId,
        deck: deckName,
        question: c.question,
        answer: c.answer,
        tags: c.tags || [],
        category: c.category || '',
        createdAt: now,
        fsrs: fsrsCard,
      };
      bindCard(insertCard, card);
      insertCard.step();
      count++;
    }
    insertCard.free();
    return count;
  }

  updateCardFSRS(card: { id: string; fsrs: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number } }): void {
    this.db.run(
      `UPDATE cards SET
        fsrs_due = ?, fsrs_stability = ?, fsrs_difficulty = ?,
        fsrs_elapsed_days = ?, fsrs_scheduled_days = ?,
        fsrs_reps = ?, fsrs_lapses = ?, fsrs_state = ?,
        fsrs_last_review = ?, fsrs_learning_steps = ?
      WHERE id = ?`,
      [
        card.fsrs.due.toISOString(),
        card.fsrs.stability,
        card.fsrs.difficulty,
        card.fsrs.elapsed_days,
        card.fsrs.scheduled_days,
        card.fsrs.reps,
        card.fsrs.lapses,
        card.fsrs.state,
        card.fsrs.last_review?.toISOString() ?? null,
        card.fsrs.learning_steps,
        card.id,
      ],
    );
  }

  insertReviewLog(card: { id: string }, rating: number, result: { card: { due: Date; stability: number; difficulty: number; state: number }; log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: Date } }): void {
    this.db.run(
      `INSERT INTO review_logs (card_id, rating, state, due, stability, difficulty,
        elapsed_days, last_elapsed_days, scheduled_days, learning_steps, review)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id,
        rating,
        result.card.state,
        result.card.due.toISOString(),
        result.card.stability,
        result.card.difficulty,
        result.log.elapsed_days,
        result.log.last_elapsed_days,
        result.log.scheduled_days,
        result.log.learning_steps,
        result.log.review.toISOString(),
      ],
    );
  }

  deleteCard(cardId: string): void {
    this.db.run('DELETE FROM review_logs WHERE card_id = ?', [cardId]);
    this.db.run('DELETE FROM cards WHERE id = ?', [cardId]);
  }

  deleteCardsByDeck(deckName: string): number {
    const r = this.db.exec('SELECT id FROM decks WHERE name = ?', [deckName]);
    if (r.length === 0 || r[0].values.length === 0) return 0;
    const deckId = r[0].values[0][0] as string;
    const count = this.db.exec('SELECT COUNT(*) FROM cards WHERE deck_id = ?', [deckId]);
    const n = count.length > 0 && count[0].values.length > 0 ? (count[0].values[0][0] as number) : 0;
    this.db.run('DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)', [deckId]);
    this.db.run('DELETE FROM cards WHERE deck_id = ?', [deckId]);
    this.db.run('DELETE FROM decks WHERE id = ?', [deckId]);
    return n;
  }

  togglePauseCategory(category: string): void {
    const r = this.db.exec("SELECT value FROM settings WHERE key = 'paused_categories'");
    let paused: string[] = [];
    if (r.length > 0 && r[0].values.length > 0) {
      try {
        paused = JSON.parse(r[0].values[0][0] as string);
      } catch { /* ignore */ }
    }
    const idx = paused.indexOf(category);
    if (idx >= 0) {
      paused.splice(idx, 1);
    } else {
      paused.push(category);
    }
    const exists = this.db.exec("SELECT 1 FROM settings WHERE key = 'paused_categories'");
    if (exists.length > 0 && exists[0].values.length > 0) {
      this.db.run("UPDATE settings SET value = ? WHERE key = 'paused_categories'", [JSON.stringify(paused)]);
    } else {
      this.db.run("INSERT INTO settings (key, value) VALUES ('paused_categories', ?)", [JSON.stringify(paused)]);
    }
  }

  undoReview(cardId: string, previousFSRS: { due: Date; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: Date; learning_steps: number }): void {
    this.db.run(
      `UPDATE cards SET
        fsrs_due = ?, fsrs_stability = ?, fsrs_difficulty = ?,
        fsrs_elapsed_days = ?, fsrs_scheduled_days = ?,
        fsrs_reps = ?, fsrs_lapses = ?, fsrs_state = ?,
        fsrs_last_review = ?, fsrs_learning_steps = ?
      WHERE id = ?`,
      [
        previousFSRS.due.toISOString(),
        previousFSRS.stability,
        previousFSRS.difficulty,
        previousFSRS.elapsed_days,
        previousFSRS.scheduled_days,
        previousFSRS.reps,
        previousFSRS.lapses,
        previousFSRS.state,
        previousFSRS.last_review?.toISOString() ?? null,
        previousFSRS.learning_steps,
        cardId,
      ],
    );
    // Remove the most recent review log for this card
    this.db.run('DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', [cardId]);
  }
}
