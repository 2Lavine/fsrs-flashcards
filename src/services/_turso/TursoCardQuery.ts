import type { Client } from '@libsql/client/web';
import { State } from 'ts-fsrs';
import type { Flashcard, Deck, ReviewEntry } from './types';

function cardFromRow(r: Record<string, unknown>): Flashcard {
  return {
    id: r['id'] as string,
    deckId: r['deck_id'] as string,
    question: r['question'] as string,
    answer: r['answer'] as string,
    tags: JSON.parse((r['tags'] as string) || '[]'),
    category: (r['category'] as string) || '',
    createdAt: r['created_at'] as string,
    fsrs: {
      due: new Date(r['fsrs_due'] as string),
      stability: r['fsrs_stability'] as number,
      difficulty: r['fsrs_difficulty'] as number,
      elapsed_days: r['fsrs_elapsed_days'] as number,
      scheduled_days: r['fsrs_scheduled_days'] as number,
      reps: r['fsrs_reps'] as number,
      lapses: r['fsrs_lapses'] as number,
      state: r['fsrs_state'] as number,
      last_review: r['fsrs_last_review'] ? new Date(r['fsrs_last_review'] as string) : undefined,
      learning_steps: r['fsrs_learning_steps'] as number,
    },
    deck: r['deck_name'] as string,
  };
}

export class TursoCardQuery {
  constructor(private client: Client) {}

  private one<T>(sql: string, params: (string | number)[] = []): Promise<T | null> {
    return this.client.execute({ sql, args: params }).then(r => (r.rows[0] as T) ?? null);
  }

  private all<T>(sql: string, params: (string | number)[] = []): Promise<T[]> {
    return this.client.execute({ sql, args: params }).then(r => r.rows as unknown as T[]);
  }

  async getCategories(): Promise<string[]> {
    const rows = await this.all<{ category: string }>("SELECT DISTINCT category FROM cards WHERE category != '' ORDER BY category");
    return rows.map(r => r.category);
  }

  async getAllCards(filterSQL = '', params: (string | number)[] = []): Promise<Flashcard[]> {
    const sql = `SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id ${filterSQL} ORDER BY c.fsrs_due ASC`;
    const rows = await this.all<Record<string, unknown>>(sql, params);
    return rows.map(cardFromRow);
  }

  async getDueCards(category?: string, excludePausedCategories?: string[], deckId?: string): Promise<Flashcard[]> {
    const conditions: string[] = [`(c.fsrs_state = ${State.New} OR c.fsrs_due <= ?)`];
    const params: (string | number)[] = [new Date().toISOString()];
    if (category) { conditions.push('c.category = ?'); params.push(category); }
    if (deckId) { conditions.push('c.deck_id = ?'); params.push(deckId); }
    if (excludePausedCategories?.length) {
      conditions.push(`c.category NOT IN (${excludePausedCategories.map(() => '?').join(',')})`);
      params.push(...excludePausedCategories);
    }
    return this.getAllCards(`WHERE ${conditions.join(' AND ')}`, params);
  }

  async getDecks(): Promise<Deck[]> {
    return this.all<Deck>('SELECT id, name, source FROM decks ORDER BY name');
  }

  async getStats() {
    const now = new Date().toISOString();
    const [total, due, newCount, learning, review, totalReviews] = await Promise.all([
      this.one<{ c: number }>('SELECT COUNT(*) as c FROM cards').then(r => r?.c ?? 0),
      this.one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [now]).then(r => r?.c ?? 0),
      this.one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New}`).then(r => r?.c ?? 0),
      this.one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`).then(r => r?.c ?? 0),
      this.one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.Review}`).then(r => r?.c ?? 0),
      this.one<{ c: number }>('SELECT COUNT(*) as c FROM review_logs').then(r => r?.c ?? 0),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const todayReviews = await this.one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${today}%`]).then(r => r?.c ?? 0);
    const avgDiff = await this.one<{ avg: number }>('SELECT AVG(fsrs_difficulty) as avg FROM cards WHERE fsrs_state != 0');
    return { total, due, new: newCount, learning, review, totalReviews, today: todayReviews, avgDifficulty: avgDiff?.avg != null ? avgDiff.avg.toFixed(2) : '-' };
  }

  async getStreak(): Promise<number> {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const r = await this.one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${ds}%`]);
      if ((r?.c ?? 0) > 0) streak++; else break;
    }
    return streak;
  }

  async getRecentLogs(limit = 30): Promise<ReviewEntry[]> {
    const rows = await this.all<Record<string, unknown>>(
      `SELECT rl.*, c.question FROM review_logs rl LEFT JOIN cards c ON rl.card_id = c.id ORDER BY rl.review DESC LIMIT ?`, [limit]);
    return rows.map(v => ({
      id: v['id'] as number, cardId: v['card_id'] as string,
      rating: v['rating'] as number, state: v['state'] as number,
      due: new Date(v['due'] as string), stability: v['stability'] as number, difficulty: v['difficulty'] as number,
      elapsedDays: v['elapsed_days'] as number, scheduledDays: v['scheduled_days'] as number,
      review: new Date(v['review'] as string),
      question: (v['question'] as string) || '(deleted card)',
    }));
  }

  async getDeckStats(): Promise<{ name: string; count: number }[]> {
    return this.all<{ name: string; count: number }>('SELECT d.name, COUNT(c.id) as count FROM decks d LEFT JOIN cards c ON c.deck_id = d.id GROUP BY d.id ORDER BY d.name');
  }

  async getDailyCounts(days = 7) {
    const res: { label: string; count: number }[] = [];
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const r = await this.one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${ds}%`]);
      res.push({ label: labels[d.getDay()], count: r?.c ?? 0 });
    }
    return res;
  }

  async getCategoryCounts() {
    return this.all<{ name: string; count: number }>("SELECT category as name, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY count DESC");
  }

  async getRatingCounts() {
    const labels: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const res: { label: string; count: number }[] = [];
    for (let r = 1; r <= 4; r++) {
      const row = await this.one<{ c: number }>('SELECT COUNT(*) as c FROM review_logs WHERE rating = ?', [r]);
      res.push({ label: labels[r], count: row?.c ?? 0 });
    }
    return res;
  }

  async getPausedCategories(): Promise<string[]> {
    const r = await this.one<{ value: string }>("SELECT value FROM settings WHERE key = 'paused_categories'");
    if (!r?.value) return [];
    try { return JSON.parse(r.value); } catch { return []; }
  }

  async getCategoryTree() {
    const rows = await this.all<{ category: string; count: number }>("SELECT category, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY category");
    const roots: { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[] = [];
    for (const r of rows) {
      const sep = r.category.indexOf('::');
      if (sep === -1) {
        roots.push({ name: r.category, count: r.count, children: [] });
      } else {
        const rootName = r.category.slice(0, sep);
        let root = roots.find(x => x.name === rootName);
        if (!root) { root = { name: rootName, count: 0, children: [] }; roots.push(root); }
        root.children.push({ name: r.category.slice(sep + 2), fullPath: r.category, count: r.count });
      }
    }
    return roots;
  }

  async getTodayProgress() {
    const today = new Date().toISOString().slice(0, 10);
    const endOfDay = today + 'T23:59:59.999Z';
    const [due, reviewed] = await Promise.all([
      this.one<{ c: number }>('SELECT COUNT(*) as c FROM cards WHERE fsrs_state != ? AND fsrs_due <= ?', [State.New, endOfDay]).then(r => r?.c ?? 0),
      this.one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${today}%`]).then(r => r?.c ?? 0),
    ]);
    return { due, reviewed };
  }
}
