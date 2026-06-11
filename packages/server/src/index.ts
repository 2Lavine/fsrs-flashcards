import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { State, createEmptyCard } from 'ts-fsrs';
import db from './db';

const app = new Hono();
app.use('*', cors());

// ─── Types ────────────────────────────────

interface Flashcard {
  id: string; deckId: string; deck: string;
  question: string; answer: string; tags: string[]; category: string;
  createdAt: string;
  fsrs: {
    due: Date; stability: number; difficulty: number; elapsed_days: number;
    scheduled_days: number; reps: number; lapses: number; state: number;
    last_review?: Date; learning_steps: number;
  };
}

function rowToCard(r: Record<string, unknown>, deckName?: string): Flashcard {
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

// ─── Helpers ──────────────────────────────

const one = (sql: string, args: (string | number)[] = []) =>
  db.execute({ sql, args }).then(r => r.rows[0] ?? null);
const all = (sql: string, args: (string | number)[] = []) =>
  db.execute({ sql, args }).then(r => r.rows as unknown as Record<string, unknown>[]);

async function getDueCardsRaw(category?: string, excludePaused?: string[], deckId?: string) {
  const c = [`(c.fsrs_state = ${State.New} OR c.fsrs_due <= ?)`];
  const a: (string | number)[] = [new Date().toISOString()];
  if (category) { c.push('c.category = ?'); a.push(category); }
  if (deckId) { c.push('c.deck_id = ?'); a.push(deckId); }
  if (excludePaused?.length) { c.push(`c.category NOT IN (${excludePaused.map(() => '?').join(',')})`); a.push(...excludePaused); }
  const rows = await all(`SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id WHERE ${c.join(' AND ')} ORDER BY c.fsrs_due ASC`, a);
  return rows.map(r => rowToCard(r));
}

function uid() { return crypto.randomUUID(); }

// ─── GET /api/health ──────────────────────

app.get('/api/health', (c) => c.json({ ok: true }));

// ─── GET /api/due-cards ───────────────────

app.get('/api/due-cards', async (c) => {
  const category = c.req.query('category');
  const deckId = c.req.query('deckId');
  const paused = c.req.query('paused')?.split(',').filter(Boolean);
  const cards = await getDueCardsRaw(category, paused, deckId);
  return c.json({ cards });
});

// ─── GET /api/stats ───────────────────────

app.get('/api/stats', async (c) => {
  const now = new Date().toISOString();
  const n10 = now.slice(0, 10);
  const [total, due, nc, lr, review, tr, td, avg] = await Promise.all([
    one('SELECT COUNT(*) as c FROM cards').then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [now]).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New}`).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.Review}`).then(r => (r?.c as number) ?? 0),
    one('SELECT COUNT(*) as c FROM review_logs').then(r => (r?.c as number) ?? 0),
    one("SELECT COUNT(*) as c FROM review_logs WHERE review LIKE ?", [`${n10}%`]).then(r => (r?.c as number) ?? 0),
    one('SELECT AVG(fsrs_difficulty) as avg FROM cards WHERE fsrs_state != 0'),
  ]);
  return c.json({ total, due, new: nc, learning: lr, review, totalReviews: tr, today: td, avgDifficulty: avg?.avg != null ? (avg.avg as number).toFixed(2) : '-' });
});

// ─── POST /api/review ─────────────────────
// Body: { cardId, rating } → Returns { nextCard }

app.post('/api/review', async (c) => {
  const { cardId, rating, fsrs, log } = await c.req.json<{
    cardId: string; rating: number;
    fsrs: Flashcard['fsrs'];
    log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: string };
  }>();
  if (!cardId || !rating) return c.json({ error: 'Missing cardId/rating' }, 400);

  await Promise.all([
    db.execute({
      sql: 'UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
      args: [fsrs.due, fsrs.stability, fsrs.difficulty, fsrs.elapsed_days, fsrs.scheduled_days, fsrs.reps, fsrs.lapses, fsrs.state, fsrs.last_review ?? null, fsrs.learning_steps, cardId],
    }),
    db.execute({
      sql: 'INSERT INTO review_logs (card_id,rating,state,due,stability,difficulty,elapsed_days,last_elapsed_days,scheduled_days,learning_steps,review) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [cardId, rating, fsrs.state, fsrs.due, fsrs.stability, fsrs.difficulty, log.elapsed_days, log.last_elapsed_days, log.scheduled_days, log.learning_steps, log.review],
    }),
  ]);

  return c.json({ ok: true });
});

// ─── POST /api/undo ───────────────────────

app.post('/api/undo', async (c) => {
  const { cardId, prevFSRS } = await c.req.json<{ cardId: string; prevFSRS: Flashcard['fsrs'] }>();
  await db.execute({
    sql: 'UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
    args: [prevFSRS.due, prevFSRS.stability, prevFSRS.difficulty, prevFSRS.elapsed_days, prevFSRS.scheduled_days, prevFSRS.reps, prevFSRS.lapses, prevFSRS.state, prevFSRS.last_review ?? null, prevFSRS.learning_steps, cardId],
  });
  await db.execute({ sql: 'DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', args: [cardId] });
  return c.json({ ok: true });
});

// ─── DELETE /api/cards/:id ────────────────

app.delete('/api/cards/:id', async (c) => {
  const id = c.req.param('id');
  await db.execute('DELETE FROM review_logs WHERE card_id = ?', [id]);
  await db.execute('DELETE FROM cards WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ─── GET /api/decks ───────────────────────

app.get('/api/decks', async (c) => {
  const rows = await all('SELECT id, name, source FROM decks ORDER BY name');
  return c.json({ decks: rows });
});

// ─── GET /api/categories ──────────────────

app.get('/api/categories', async (c) => {
  const deckId = c.req.query('deckId');
  const rows = deckId
    ? await all("SELECT DISTINCT category FROM cards WHERE category != '' AND deck_id = ? ORDER BY category", [deckId])
    : await all("SELECT DISTINCT category FROM cards WHERE category != '' ORDER BY category");
  return c.json({ categories: rows.map(r => r['category'] as string) });
});

// ─── GET /api/paused ──────────────────────

app.get('/api/paused', async (c) => {
  const r = await one("SELECT value FROM settings WHERE key = 'paused_categories'");
  try { return c.json({ paused: JSON.parse((r?.value as string) || '[]') }); } catch { return c.json({ paused: [] }); }
});

// ─── POST /api/paused/:cat ─────────────────

app.post('/api/paused/:cat', async (c) => {
  const cat = c.req.param('cat');
  const r = await one("SELECT value FROM settings WHERE key = 'paused_categories'");
  let paused: string[] = [];
  try { paused = JSON.parse((r?.value as string) || '[]'); } catch {}
  const idx = paused.indexOf(cat);
  if (idx >= 0) paused.splice(idx, 1); else paused.push(cat);
  await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused_categories', ?)", [JSON.stringify(paused)]);
  return c.json({ ok: true });
});

// ─── POST /api/import ─────────────────────

app.post('/api/import', async (c) => {
  const { deck, source, cards } = await c.req.json<{ deck: string; source?: string; cards: { question: string; answer: string; tags?: string[]; category?: string }[] }>();
  if (!deck || !cards?.length) return c.json({ error: 'Need deck + cards' }, 400);

  const deckId = uid(); const now = new Date().toISOString();
  await db.execute('INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?,?,?,?)', [deckId, deck, source || '', now]);

  let n = 0;
  for (const c of cards) {
    const fsrs = createEmptyCard();
    await db.execute(
      'INSERT INTO cards (id,deck_id,question,answer,tags,category,created_at,fsrs_due,fsrs_stability,fsrs_difficulty,fsrs_elapsed_days,fsrs_scheduled_days,fsrs_reps,fsrs_lapses,fsrs_state,fsrs_last_review,fsrs_learning_steps) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), deckId, c.question, c.answer, JSON.stringify(c.tags || []), c.category || '', now, now, 0, 0, 0, 0, 0, 0, State.New, null, 0]);
    n++;
  }
  return c.json({ ok: true, deck, imported: n });
});

// ─── Start ────────────────────────────────

const port = parseInt(process.env.PORT || '3001');
serve({ fetch: app.fetch, port });
console.log(`Server running on http://localhost:${port}`);
