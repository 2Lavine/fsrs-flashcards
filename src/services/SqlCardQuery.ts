import type { Database } from 'sql.js';
import { State } from 'ts-fsrs';
import type { ICardQuery } from './ICardQuery';
import type { Flashcard, Deck, ReviewEntry } from './types';

function cardFromRow(r: (string | number | null)[]): Flashcard {
  return {
    id: r[0] as string,
    deckId: r[1] as string,
    question: r[2] as string,
    answer: r[3] as string,
    tags: JSON.parse((r[4] as string) || '[]'),
    category: (r[5] as string) || '',
    createdAt: r[6] as string,
    fsrs: {
      due: new Date(r[7] as string),
      stability: r[8] as number,
      difficulty: r[9] as number,
      elapsed_days: r[10] as number,
      scheduled_days: r[11] as number,
      reps: r[12] as number,
      lapses: r[13] as number,
      state: r[14] as number,
      last_review: r[15] ? new Date(r[15] as string) : undefined,
      learning_steps: r[16] as number,
    },
    deck: r[17] as string,
  };
}

export class SqlCardQuery implements ICardQuery {
  constructor(private db: Database) {}

  getCategories(): string[] {
    const r = this.db.exec("SELECT DISTINCT category FROM cards WHERE category != '' ORDER BY category");
    if (r.length === 0) return [];
    return r[0].values.map(v => v[0] as string);
  }

  getAllCards(filterSQL = '', params: (string | number)[] = []): Flashcard[] {
    const sql = `
      SELECT c.id, c.deck_id, c.question, c.answer, c.tags, c.category, c.created_at,
             c.fsrs_due, c.fsrs_stability, c.fsrs_difficulty, c.fsrs_elapsed_days,
             c.fsrs_scheduled_days, c.fsrs_reps, c.fsrs_lapses, c.fsrs_state, c.fsrs_last_review,
             c.fsrs_learning_steps, d.name as deck_name
      FROM cards c
      JOIN decks d ON c.deck_id = d.id
      ${filterSQL}
      ORDER BY c.fsrs_due ASC
    `;
    const result = this.db.exec(sql, params);
    if (result.length === 0) return [];
    return result[0].values.map((row) => cardFromRow(row as unknown as (string | number | null)[]));
  }

  getDueCards(category?: string, excludePausedCategories: string[] = [], deckId?: string): Flashcard[] {
    const now = new Date().toISOString();
    const conditions: string[] = ['(c.fsrs_state = ? OR c.fsrs_due <= ?)'];
    const params: (string | number)[] = [State.New, now];

    if (category) {
      conditions.push('(c.category = ? OR c.category LIKE ?)');
      params.push(category, `${category}/%`);
    }
    if (deckId) {
      conditions.push('c.deck_id = ?');
      params.push(deckId);
    }
    if (excludePausedCategories.length > 0) {
      const excludeClauses = excludePausedCategories.map(() => '(c.category = ? OR c.category LIKE ?)').join(' OR ');
      conditions.push(`NOT (${excludeClauses})`);
      for (const cat of excludePausedCategories) {
        params.push(cat, `${cat}/%`);
      }
    }

    return this.getAllCards(`WHERE ${conditions.join(' AND ')}`, params);
  }

  getDecks(): Deck[] {
    const r = this.db.exec('SELECT id, name, source FROM decks ORDER BY name');
    if (r.length === 0) return [];
    return r[0].values.map((v) => ({ id: v[0] as string, name: v[1] as string, source: v[2] as string }));
  }

  getStats() {
    const get = (sql: string, params: (string | number)[] = []) => {
      const r = this.db.exec(sql, params);
      return r.length > 0 && r[0].values.length > 0 ? (r[0].values[0][0] as number) : 0;
    };

    const now = new Date().toISOString();
    const total = get('SELECT COUNT(*) FROM cards');
    const due = get(`SELECT COUNT(*) FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [now]);
    const newCount = get(`SELECT COUNT(*) FROM cards WHERE fsrs_state = ${State.New}`);
    const learning = get(`SELECT COUNT(*) FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`);
    const review = get(`SELECT COUNT(*) FROM cards WHERE fsrs_state = ${State.Review}`);
    const totalReviews = get('SELECT COUNT(*) FROM review_logs');
    const today = new Date().toISOString().slice(0, 10);
    const todayReviews = get("SELECT COUNT(*) FROM review_logs WHERE review LIKE ?", [`${today}%`]);

    const avgDiffR = this.db.exec('SELECT AVG(fsrs_difficulty) FROM cards WHERE fsrs_state != 0');
    const avgDifficulty =
      avgDiffR.length > 0 && avgDiffR[0].values.length > 0 && avgDiffR[0].values[0][0] != null
        ? (avgDiffR[0].values[0][0] as number).toFixed(2)
        : '-';

    return { total, due, new: newCount, learning, review, totalReviews, today: todayReviews, avgDifficulty };
  }

  getStreak(): number {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const r = this.db.exec("SELECT COUNT(*) FROM review_logs WHERE review LIKE ?", [`${ds}%`]);
      const count = r.length > 0 && r[0].values.length > 0 ? (r[0].values[0][0] as number) : 0;
      if (count > 0) streak++;
      else break;
    }
    return streak;
  }

  getRecentLogs(limit = 30): ReviewEntry[] {
    const r = this.db.exec(
      `SELECT rl.id, rl.card_id, rl.rating, rl.state, rl.due, rl.stability, rl.difficulty,
              rl.elapsed_days, rl.scheduled_days, rl.review, c.question
       FROM review_logs rl
       LEFT JOIN cards c ON rl.card_id = c.id
       ORDER BY rl.review DESC
       LIMIT ?`,
      [limit],
    );
    if (r.length === 0) return [];
    return r[0].values.map((v) => ({
      id: v[0] as number,
      cardId: v[1] as string,
      rating: v[2] as number,
      state: v[3] as number,
      due: new Date(v[4] as string),
      stability: v[5] as number,
      difficulty: v[6] as number,
      elapsedDays: v[7] as number,
      scheduledDays: v[8] as number,
      review: new Date(v[9] as string),
      question: (v[10] as string) || '(deleted card)',
    }));
  }

  getDeckStats(): { name: string; count: number }[] {
    const r = this.db.exec(
      'SELECT d.name, COUNT(c.id) FROM decks d LEFT JOIN cards c ON c.deck_id = d.id GROUP BY d.id ORDER BY d.name',
    );
    if (r.length === 0) return [];
    return r[0].values.map((v) => ({ name: v[0] as string, count: v[1] as number }));
  }

  getDailyCounts(days = 7): { label: string; count: number }[] {
    const result: { label: string; count: number }[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const r = this.db.exec("SELECT COUNT(*) FROM review_logs WHERE review LIKE ?", [`${ds}%`]);
      const count = r.length > 0 && r[0].values.length > 0 ? (r[0].values[0][0] as number) : 0;
      result.push({ label: dayLabels[d.getDay()], count });
    }
    return result;
  }

  getCategoryCounts(): { name: string; count: number }[] {
    const r = this.db.exec(
      "SELECT category, COUNT(*) FROM cards WHERE category != '' GROUP BY category ORDER BY COUNT(*) DESC",
    );
    if (r.length === 0) return [];
    return r[0].values.map((v) => ({ name: v[0] as string, count: v[1] as number }));
  }

  getRatingCounts(): { label: string; count: number }[] {
    const ratingLabels: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const result: { label: string; count: number }[] = [];
    for (let r = 1; r <= 4; r++) {
      const q = this.db.exec('SELECT COUNT(*) FROM review_logs WHERE rating = ?', [r]);
      const count = q.length > 0 && q[0].values.length > 0 ? (q[0].values[0][0] as number) : 0;
      result.push({ label: ratingLabels[r], count });
    }
    return result;
  }

  getPausedCategories(): string[] {
    const r = this.db.exec("SELECT value FROM settings WHERE key = 'paused_categories'");
    if (r.length === 0 || r[0].values.length === 0) return [];
    try {
      return JSON.parse(r[0].values[0][0] as string);
    } catch {
      return [];
    }
  }

  getTodayProgress(): { due: number; reviewed: number } {
    const today = new Date().toISOString().slice(0, 10);
    const endOfDay = today + 'T23:59:59.999Z';
    const r1 = this.db.exec(
      'SELECT COUNT(*) FROM cards WHERE fsrs_state != ? AND fsrs_due <= ?',
      [State.New, endOfDay],
    );
    const due = r1.length > 0 && r1[0].values.length > 0 ? (r1[0].values[0][0] as number) : 0;
    const r2 = this.db.exec(
      "SELECT COUNT(*) FROM review_logs WHERE review LIKE ?",
      [`${today}%`],
    );
    const reviewed = r2.length > 0 && r2[0].values.length > 0 ? (r2[0].values[0][0] as number) : 0;
    return { due, reviewed };
  }

  getCategoryTree(): { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[] {
    const cats = this.getCategories();
    const tree: Record<string, { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }> = {};

    for (const cat of cats) {
      const parts = cat.split('/');
      const root = parts[0];

      if (!tree[root]) {
        tree[root] = { name: root, count: 0, children: [] };
      }

      if (parts.length === 1) {
        const r = this.db.exec('SELECT COUNT(*) FROM cards WHERE category = ?', [cat]);
        const count = r.length > 0 && r[0].values.length > 0 ? (r[0].values[0][0] as number) : 0;
        tree[root].count += count;
      } else {
        const r = this.db.exec('SELECT COUNT(*) FROM cards WHERE category = ? OR category LIKE ?', [cat, `${cat}/%`]);
        const count = r.length > 0 && r[0].values.length > 0 ? (r[0].values[0][0] as number) : 0;
        tree[root].count += count;
        tree[root].children.push({ name: parts[parts.length - 1], fullPath: cat, count });
      }
    }

    return Object.values(tree).sort((a, b) => b.count - a.count);
  }
}
