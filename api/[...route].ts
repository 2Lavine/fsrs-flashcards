import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';
import { State, createEmptyCard } from 'ts-fsrs';

const client = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function uid() { return crypto.randomUUID(); }
const now = () => new Date().toISOString();

// ─── Route table ────────────────────────────

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const routes: Record<string, Handler> = {
  // Health
  'GET /api/health': async (_req, res) => { res.json({ ok: true }); },

  // Due cards
  'GET /api/due-cards': async (req, res) => {
    const { category, deckId, paused } = req.query;
    const pa = typeof paused === 'string' ? paused.split(',').filter(Boolean) : [];
    const conds = [`(c.fsrs_state = ${State.New} OR c.fsrs_due <= ?)`];
    const args: (string | number)[] = [now()];
    if (category) { conds.push('c.category = ?'); args.push(String(category)); }
    if (deckId) { conds.push('c.deck_id = ?'); args.push(String(deckId)); }
    if (pa.length) { conds.push(`c.category NOT IN (${pa.map(() => '?').join(',')})`); args.push(...pa); }
    const r = await client.execute({
      sql: `SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id WHERE ${conds.join(' AND ')} ORDER BY c.fsrs_due ASC`,
      args,
    });
    res.json({ cards: r.rows });
  },

  // All cards (browse/search)
  'GET /api/cards': async (req, res) => {
    const { search, deckId } = req.query;
    const conds: string[] = []; const args: string[] = [];
    if (search) { conds.push('(c.question LIKE ? OR c.answer LIKE ? OR c.tags LIKE ? OR d.name LIKE ?)'); const q = `%${search}%`; args.push(q, q, q, q); }
    if (deckId) { conds.push('c.deck_id = ?'); args.push(String(deckId)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const r = await client.execute({ sql: `SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id ${where} ORDER BY c.fsrs_due ASC`, args });
    res.json({ cards: r.rows });
  },

  // Stats
  'GET /api/stats': async (_req, res) => {
    const n = now();
    const [total, due, nc, lr, review, tr, td] = await Promise.all([
      client.execute('SELECT COUNT(*) as c FROM cards').then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [n]).then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New}`).then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`).then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.Review}`).then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute('SELECT COUNT(*) as c FROM review_logs').then(r => (r.rows[0]?.c as number) ?? 0),
      client.execute("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${n.slice(0, 10)}%`]).then(r => (r.rows[0]?.c as number) ?? 0),
    ]);
    const avg = await client.execute('SELECT AVG(fsrs_difficulty) as avg FROM cards WHERE fsrs_state != 0');
    res.json({ total, due, new: nc, learning: lr, review, totalReviews: tr, today: td, avgDifficulty: avg.rows[0]?.avg != null ? (avg.rows[0].avg as number).toFixed(2) : '-' });
  },

  // Streak
  'GET /api/streak': async (_req, res) => {
    const r = await client.execute(`
      WITH RECURSIVE dates(d) AS (SELECT date('now') UNION ALL SELECT date(d, '-1 day') FROM dates LIMIT 365),
      daily AS (SELECT substr(review, 1, 10) as day, COUNT(*) as c FROM review_logs GROUP BY day)
      SELECT COUNT(*) as streak FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c > 0
      AND dates.d > COALESCE((SELECT dates.d FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c IS NULL ORDER BY dates.d DESC LIMIT 1), date('now', '-365 day'))
    `);
    res.json({ streak: (r.rows[0]?.streak as number) ?? 0 });
  },

  // Decks
  'GET /api/decks': async (_req, res) => {
    const r = await client.execute('SELECT id, name, source FROM decks ORDER BY name');
    res.json({ decks: r.rows });
  },

  // Categories
  'GET /api/categories': async (req, res) => {
    const deckId = req.query.deckId;
    const r = deckId
      ? await client.execute("SELECT DISTINCT category as name FROM cards WHERE category != '' AND deck_id = ? ORDER BY category", [String(deckId)])
      : await client.execute("SELECT DISTINCT category as name FROM cards WHERE category != '' ORDER BY category");
    res.json({ categories: r.rows.map(r => r.name as string) });
  },

  // Paused categories
  'GET /api/paused': async (_req, res) => {
    const r = await client.execute("SELECT value FROM settings WHERE key = 'paused_categories'");
    try { res.json({ paused: JSON.parse((r.rows[0]?.value as string) || '[]') }); } catch { res.json({ paused: [] }); }
  },

  // Toggle pause
  'POST /api/paused/:cat': async (req, res) => {
    const cat = decodeURIComponent(req.query.cat as string || '');
    const r = await client.execute("SELECT value FROM settings WHERE key = 'paused_categories'");
    let paused: string[] = [];
    try { paused = JSON.parse((r.rows[0]?.value as string) || '[]'); } catch {}
    const idx = paused.indexOf(cat);
    if (idx >= 0) paused.splice(idx, 1); else paused.push(cat);
    await client.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused_categories', ?)", [JSON.stringify(paused)]);
    res.json({ ok: true });
  },

  // Review
  'POST /api/review': async (req, res) => {
    const { cardId, rating, fsrs, log } = req.body || {};
    if (!cardId || !rating || !fsrs || !log) return res.status(400).json({ error: 'Missing fields' });
    await Promise.all([
      client.execute({
        sql: 'UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
        args: [fsrs.due, fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, fsrs.last_review ?? null, fsrs.learning_steps, cardId],
      }),
      client.execute({
        sql: 'INSERT INTO review_logs (card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        args: [cardId, rating, fsrs.state, fsrs.due, fsrs.stability, fsrs.difficulty, log.elapsed_days, log.last_elapsed_days, log.scheduled_days, log.learning_steps, log.review],
      }),
    ]);
    res.json({ ok: true });
  },

  // Undo
  'POST /api/undo': async (req, res) => {
    const { cardId, prevFSRS } = req.body || {};
    if (!cardId || !prevFSRS) return res.status(400).json({ error: 'Missing fields' });
    await client.execute({
      sql: 'UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
      args: [prevFSRS.due, prevFSRS.stability, prevFSRS.difficulty, prevFSRS.elapsed_days, prevFSRS.scheduled_days, prevFSRS.reps, prevFSRS.lapses, prevFSRS.state, prevFSRS.last_review ?? null, prevFSRS.learning_steps, cardId],
    });
    await client.execute('DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', [cardId]);
    res.json({ ok: true });
  },

  // Delete card
  'DELETE /api/cards/:id': async (req, res) => {
    const id = req.query.id as string;
    await client.execute('DELETE FROM review_logs WHERE card_id = ?', [id]);
    await client.execute('DELETE FROM cards WHERE id = ?', [id]);
    res.json({ ok: true });
  },

  // Delete deck
  'DELETE /api/decks/:name': async (req, res) => {
    const name = decodeURIComponent(req.query.name as string);
    const r = await client.execute('SELECT id FROM decks WHERE name = ?', [name]);
    if (r.rows.length === 0) return res.json({ ok: true, deleted: 0 });
    const deckId = r.rows[0].id as string;
    await client.execute('DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)', [deckId]);
    await client.execute('DELETE FROM cards WHERE deck_id = ?', [deckId]);
    await client.execute('DELETE FROM decks WHERE id = ?', [deckId]);
    res.json({ ok: true, deleted: 1 });
  },

  // Import
  'POST /api/import': async (req, res) => {
    const { deck, source, cards } = req.body || {};
    if (!deck || !cards?.length) return res.status(400).json({ error: 'Need deck + cards' });
    const deckId = uid(); const n = now();
    await client.execute('INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?,?,?,?)', [deckId, deck, source || '', n]);
    let count = 0;
    for (const c of cards) {
      const fsrs = createEmptyCard();
      await client.execute(
        'INSERT INTO cards (id,deck_id,question,answer,tags,category,created_at,fsrs_due,fsrs_stability,fsrs_difficulty,fsrs_elapsed_days,fsrs_scheduled_days,fsrs_reps,fsrs_lapses,fsrs_state,fsrs_last_review,fsrs_learning_steps) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [uid(), deckId, c.question, c.answer, JSON.stringify(c.tags || []), c.category || '', n, n, 0, 0, 0, 0, 0, 0, State.New, null, 0]);
      count++;
    }
    res.json({ ok: true, deck, imported: count });
  },

  // Daily counts (for stats chart)
  'GET /api/daily-counts': async (_req, res) => {
    const counts: { label: string; count: number }[] = [];
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const r = await client.execute("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${ds}%`]);
      counts.push({ label: labels[d.getDay()], count: (r.rows[0]?.c as number) ?? 0 });
    }
    res.json({ daily: counts });
  },

  // Recent logs
  'GET /api/recent-logs': async (_req, res) => {
    const r = await client.execute(
      'SELECT rl.*, c.question FROM review_logs rl LEFT JOIN cards c ON rl.card_id = c.id ORDER BY rl.review DESC LIMIT 30');
    res.json({ logs: r.rows });
  },

  // Category counts
  'GET /api/category-counts': async (_req, res) => {
    const r = await client.execute("SELECT category as name, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY count DESC");
    res.json({ categories: r.rows });
  },

  // Rating counts
  'GET /api/rating-counts': async (_req, res) => {
    const labels: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const result: { label: string; count: number }[] = [];
    for (let i = 1; i <= 4; i++) {
      const r = await client.execute('SELECT COUNT(*) as c FROM review_logs WHERE rating = ?', [i]);
      result.push({ label: labels[i], count: (r.rows[0]?.c as number) ?? 0 });
    }
    res.json({ ratings: result });
  },
};

// ─── Catch-all handler ──────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Resolve route key: "METHOD /api/path"
  let path = req.url?.split('?')[0] || '/';
  // Handle dynamic segments: /api/paused/:cat, /api/cards/:id, /api/decks/:name
  let key = `${req.method} ${path}`;

  // Try exact match first
  if (routes[key]) return routes[key](req, res);

  // Try dynamic match
  for (const [routeKey, handler] of Object.entries(routes)) {
    const [method, routePath] = routeKey.split(' ');
    if (method !== req.method) continue;
    const routeParts = routePath.split('/');
    const pathParts = path.split('/');
    if (routeParts.length !== pathParts.length) continue;
    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false; break;
      }
    }
    if (match) {
      req.query = { ...req.query, ...params };
      return handler(req, res);
    }
  }

  res.status(404).json({ error: 'Not found', path, method: req.method });
}
