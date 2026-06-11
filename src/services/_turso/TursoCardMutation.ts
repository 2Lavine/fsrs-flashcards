import type { Client } from '@libsql/client/web';

function uid(): string {
  return crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export class TursoCardMutation {
  constructor(private client: Client) {}

  private exec(sql: string, params: (string | number | null)[] = []) {
    return this.client.execute({ sql, args: params as (string | number)[] }).catch(err => {
      console.warn('[turso] write failed:', sql.slice(0, 60), err.message);
    });
  }

  async addCards(deckName: string, source: string, cards: { id: string; deckId: string; question: string; answer: string; tags: string[]; category: string; createdAt: string; fsrs: Record<string, unknown> }[]) {
    await this.exec('INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?, ?, ?, ?)', [cards[0].deckId, deckName, source, new Date().toISOString()]);
    for (const c of cards) {
      await this.exec(
        `INSERT OR REPLACE INTO cards (id, deck_id, question, answer, tags, category, created_at,
          fsrs_due, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review, fsrs_learning_steps)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [c.id, c.deckId, c.question, c.answer, JSON.stringify(c.tags), c.category, c.createdAt,
          c.fsrs.due, c.fsrs.stability, c.fsrs.difficulty, c.fsrs.elapsed_days, c.fsrs.scheduled_days, c.fsrs.reps, c.fsrs.lapses, c.fsrs.state, c.fsrs.last_review, c.fsrs.learning_steps]
      );
    }
  }

  async updateCardFSRS(id: string, fsrs: Record<string, unknown>) {
    await this.exec(
      `UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?`,
      [fsrs.due, fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, fsrs.last_review, fsrs.learning_steps, id]);
  }

  async insertReviewLog(cardId: string, rating: number, result: Record<string, unknown>) {
    await this.exec(
      `INSERT INTO review_logs (card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [cardId, rating, result.state, result.due, result.stability, result.difficulty, result.elapsed_days, result.last_elapsed_days, result.scheduled_days, result.learning_steps, result.review]);
  }

  async deleteCard(cardId: string) {
    await this.exec('DELETE FROM review_logs WHERE card_id = ?', [cardId]);
    await this.exec('DELETE FROM cards WHERE id = ?', [cardId]);
  }

  async undoReview(cardId: string, prevFSRS: Record<string, unknown>) {
    await this.exec(
      `UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?`,
      [prevFSRS.due, prevFSRS.stability, prevFSRS.difficulty, prevFSRS.elapsed_days, prevFSRS.scheduled_days, prevFSRS.reps, prevFSRS.lapses, prevFSRS.state, prevFSRS.last_review, prevFSRS.learning_steps, cardId]);
    await this.exec('DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', [cardId]);
  }

  async deleteCardsByDeck(deckName: string) {
    const r = await this.client.execute({ sql: 'SELECT id FROM decks WHERE name = ?', args: [deckName] });
    if (r.rows.length === 0) return;
    const deckId = r.rows[0]['id'] as string;
    await this.exec('DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)', [deckId]);
    await this.exec('DELETE FROM cards WHERE deck_id = ?', [deckId]);
    await this.exec('DELETE FROM decks WHERE id = ?', [deckId]);
  }

  async togglePauseCategory(category: string) {
    const r = await this.client.execute({ sql: "SELECT value FROM settings WHERE key = 'paused_categories'" });
    let paused: string[] = [];
    if (r.rows.length > 0) {
      try { paused = JSON.parse(r.rows[0]['value'] as string); } catch { /* ignore */ }
    }
    const idx = paused.indexOf(category);
    if (idx >= 0) paused.splice(idx, 1); else paused.push(category);
    const val = JSON.stringify(paused);
    await this.exec("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused_categories', ?)", [val]);
  }
}
