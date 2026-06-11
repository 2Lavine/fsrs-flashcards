import { State } from 'ts-fsrs';
import { execute } from '../db';
import type { Flashcard, Deck, ICardQuery } from './types';

function rowToCard(r: Record<string, unknown>): Flashcard {
  return {
    id: r['id'] as string, deckId: r['deck_id'] as string, deck: r['deck_name'] as string,
    question: r['question'] as string, answer: r['answer'] as string,
    tags: JSON.parse((r['tags'] as string) || '[]'), category: (r['category'] as string) || '',
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


const one = async <T>(sql: string, args?: (string | number)[]) =>
  execute(sql, args ?? []).then(r => (r.rows[0] as T) ?? null);
const all = async <T>(sql: string, args?: (string | number)[]) =>
  execute(sql, args ?? []).then(r => r.rows as unknown as T[]);

export class CardQuery implements ICardQuery {
  async getCategories() { return (await all<{ category: string }>("SELECT DISTINCT category FROM cards WHERE category != '' ORDER BY category")).map(r => r.category); }
  async getAllCards(filterSQL = '', args: (string | number)[] = []) { return (await all<Record<string, unknown>>(`SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id ${filterSQL} ORDER BY c.fsrs_due ASC`, args)).map(rowToCard); }
  async getDueCards(category?: string, excludePaused?: string[], deckId?: string) {
    const c = [`(c.fsrs_state = ${State.New} OR c.fsrs_due <= ?)`]; const a: (string | number)[] = [new Date().toISOString()];
    if (category) { c.push('c.category = ?'); a.push(category); }
    if (deckId) { c.push('c.deck_id = ?'); a.push(deckId); }
    if (excludePaused?.length) { c.push(`c.category NOT IN (${excludePaused.map(() => '?').join(',')})`); a.push(...excludePaused); }
    return (await all<Record<string, unknown>>(`SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id WHERE ${c.join(' AND ')} ORDER BY c.fsrs_due ASC`, a)).map(rowToCard);
  }
  async getDecks() { return all<Deck>('SELECT id, name, source FROM decks ORDER BY name'); }
  async getStats() {
    const n = new Date().toISOString(), t = n.slice(0, 10);
    const [total, due, nc, lr, rv, tr, td, avg] = await Promise.all([
      one<{ c: number }>('SELECT COUNT(*) as c FROM cards').then(r => r?.c ?? 0),
      one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [n]).then(r => r?.c ?? 0),
      one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New}`).then(r => r?.c ?? 0),
      one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`).then(r => r?.c ?? 0),
      one<{ c: number }>(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.Review}`).then(r => r?.c ?? 0),
      one<{ c: number }>('SELECT COUNT(*) as c FROM review_logs').then(r => r?.c ?? 0),
      one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${t}%`]).then(r => r?.c ?? 0),
      one<{ avg: number }>('SELECT AVG(fsrs_difficulty) as avg FROM cards WHERE fsrs_state != 0'),
    ]);
    return { total, due, new: nc, learning: lr, review: rv, totalReviews: tr, today: td, avgDifficulty: avg?.avg != null ? avg.avg.toFixed(2) : '-' };
  }
  async getStreak() { let s = 0; const t = new Date(); for (let i = 0; i < 365; i++) { const d = new Date(t); d.setDate(d.getDate() - i); if (await one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${d.toISOString().slice(0, 10)}%`]).then(r => (r?.c ?? 0) > 0)) s++; else break; } return s; }
  async getRecentLogs(l = 30) { return (await all<Record<string, unknown>>(`SELECT rl.*, c.question FROM review_logs rl LEFT JOIN cards c ON rl.card_id = c.id ORDER BY rl.review DESC LIMIT ?`, [l])).map(v => ({ id: v['id'] as number, cardId: v['card_id'] as string, rating: v['rating'] as number, state: v['state'] as number, due: new Date(v['due'] as string), stability: v['stability'] as number, difficulty: v['difficulty'] as number, elapsedDays: v['elapsed_days'] as number, scheduledDays: v['scheduled_days'] as number, review: new Date(v['review'] as string), question: (v['question'] as string) || '(deleted card)' })); }
  async getDailyCounts(d = 7) { const lb = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; const r: { label: string; count: number }[] = []; for (let i = d-1; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate()-i); r.push({ label: lb[dt.getDay()], count: await one<{ c: number }>("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${dt.toISOString().slice(0,10)}%`]).then(r => r?.c ?? 0) }); } return r; }
  async getCategoryCounts() { return all<{ name: string; count: number }>("SELECT category as name, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY count DESC"); }
  async getRatingCounts() { const lb: Record<number,string> = {1:'Again',2:'Hard',3:'Good',4:'Easy'}; const r: { label: string; count: number }[] = []; for (let i=1;i<=4;i++) r.push({label:lb[i],count:await one<{c:number}>('SELECT COUNT(*) as c FROM review_logs WHERE rating = ?',[i]).then(r=>r?.c??0)}); return r; }
  async getPausedCategories() { const r = await one<{ value: string }>("SELECT value FROM settings WHERE key = 'paused_categories'"); if (!r?.value) return []; try { return JSON.parse(r.value); } catch { return []; } }
  async getCategoriesByDeck(deckId?: string) {
    if (!deckId) return this.getCategories();
    return (await all<{ category: string }>("SELECT DISTINCT category FROM cards WHERE category != '' AND deck_id = ? ORDER BY category", [deckId])).map(r => r.category);
  }

  async getCategoryTree() {
    const rows = await all<{ category: string; count: number }>("SELECT category, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY category");
    const roots: { name: string; count: number; children: { name: string; fullPath: string; count: number }[] }[] = [];
    for (const r of rows) {
      const sep = r.category.indexOf('::');
      if (sep === -1) roots.push({ name: r.category, count: r.count, children: [] });
      else { const rn = r.category.slice(0, sep); let rt = roots.find(x => x.name === rn); if (!rt) { rt = { name: rn, count: 0, children: [] }; roots.push(rt); } rt.children.push({ name: r.category.slice(sep + 2), fullPath: r.category, count: r.count }); }
    }
    return roots;
  }
}
