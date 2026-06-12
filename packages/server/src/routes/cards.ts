import { Hono } from 'hono';
import { State, createEmptyCard } from 'ts-fsrs';
import db from '../db';
import { one, all, uid, getDueCardsRaw } from '../types';

const cards = new Hono();

// ─── GET /due-cards ─────────────────────────

cards.get('/due-cards', async (c) => {
  const category = c.req.query('category');
  const deckId = c.req.query('deckId');
  const paused = c.req.query('paused')?.split(',').filter(Boolean);
  const result = await getDueCardsRaw(category, paused, deckId);
  return c.json({ cards: result });
});

// ─── GET /cards ─────────────────────────────

cards.get('/cards', async (c) => {
  const search = c.req.query('search');
  const deckId = c.req.query('deckId');
  const conds: string[] = [];
  const args: string[] = [];
  if (search) {
    conds.push('(c.question LIKE ? OR c.answer LIKE ? OR c.tags LIKE ? OR d.name LIKE ?)');
    const q = `%${search}%`;
    args.push(q, q, q, q);
  }
  if (deckId) { conds.push('c.deck_id = ?'); args.push(deckId); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = await all(
    `SELECT c.*, d.name as deck_name FROM cards c JOIN decks d ON c.deck_id = d.id ${where} ORDER BY c.fsrs_due ASC`,
    args
  );
  return c.json({ cards: rows });
});

// ─── PUT /cards/:id ─────────────────────────

cards.put('/cards/:id', async (c) => {
  const id = c.req.param('id');
  const { question, answer } = await c.req.json<{ question: string; answer: string }>();
  if (!question || !answer) return c.json({ error: 'Missing question or answer' }, 400);
  await db.execute('UPDATE cards SET question = ?, answer = ? WHERE id = ?', [question, answer, id]);
  return c.json({ ok: true });
});

// ─── DELETE /cards/:id ──────────────────────

cards.delete('/cards/:id', async (c) => {
  const id = c.req.param('id');
  await db.execute('DELETE FROM review_logs WHERE card_id = ?', [id]);
  await db.execute('DELETE FROM cards WHERE id = ?', [id]);
  return c.json({ ok: true });
});

// ─── GET /decks ─────────────────────────────

cards.get('/decks', async (c) => {
  const rows = await all('SELECT id, name, source FROM decks ORDER BY name');
  return c.json({ decks: rows });
});

// ─── GET /categories ────────────────────────

cards.get('/categories', async (c) => {
  const deckId = c.req.query('deckId');
  const rows = deckId
    ? await all("SELECT DISTINCT category FROM cards WHERE category != '' AND deck_id = ? ORDER BY category", [deckId])
    : await all("SELECT DISTINCT category FROM cards WHERE category != '' ORDER BY category");
  return c.json({ categories: rows.map(r => r['category'] as string) });
});

// ─── GET /paused ────────────────────────────

cards.get('/paused', async (c) => {
  const r = await one("SELECT value FROM settings WHERE key = 'paused_categories'");
  try { return c.json({ paused: JSON.parse((r?.value as string) || '[]') }); } catch { return c.json({ paused: [] }); }
});

// ─── POST /paused/:cat ──────────────────────

cards.post('/paused/:cat', async (c) => {
  const cat = c.req.param('cat');
  const r = await one("SELECT value FROM settings WHERE key = 'paused_categories'");
  let paused: string[] = [];
  try { paused = JSON.parse((r?.value as string) || '[]'); } catch {}
  const idx = paused.indexOf(cat);
  if (idx >= 0) paused.splice(idx, 1); else paused.push(cat);
  await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('paused_categories', ?)", [JSON.stringify(paused)]);
  return c.json({ ok: true });
});

// ─── DELETE /decks/:name ────────────────────

cards.delete('/decks/:name', async (c) => {
  const name = c.req.param('name');
  const r = await db.execute('SELECT id FROM decks WHERE name = ?', [name]);
  if (r.rows.length === 0) return c.json({ ok: true, deleted: 0 });
  const deckId = r.rows[0].id as string;
  await db.execute('DELETE FROM review_logs WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)', [deckId]);
  await db.execute('DELETE FROM cards WHERE deck_id = ?', [deckId]);
  await db.execute('DELETE FROM decks WHERE id = ?', [deckId]);
  return c.json({ ok: true, deleted: 1 });
});

// ─── POST /import ───────────────────────────

cards.post('/import', async (c) => {
  const { deck, source, cards: cardList } = await c.req.json<{ deck: string; source?: string; cards: { question: string; answer: string; tags?: string[]; category?: string }[] }>();
  if (!deck || !cardList?.length) return c.json({ error: 'Need deck + cards' }, 400);

  const now = new Date().toISOString();
  let deckRow = await one('SELECT id FROM decks WHERE name = ?', [deck]);
  let deckId: string;
  if (deckRow) {
    deckId = deckRow.id as string;
  } else {
    deckId = uid();
    await db.execute('INSERT INTO decks (id, name, source, created_at) VALUES (?,?,?,?)', [deckId, deck, source || '', now]);
  }

  let n = 0;
  for (const cd of cardList) {
    const fsrs = createEmptyCard();
    await db.execute(
      'INSERT INTO cards (id,deck_id,question,answer,tags,category,created_at,fsrs_due,fsrs_stability,fsrs_difficulty,fsrs_elapsed_days,fsrs_scheduled_days,fsrs_reps,fsrs_lapses,fsrs_state,fsrs_last_review,fsrs_learning_steps) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [uid(), deckId, cd.question, cd.answer, JSON.stringify(cd.tags || []), cd.category || '', now, now, 0, 0, 0, 0, 0, 0, State.New, null, 0]);
    n++;
  }
  return c.json({ ok: true, deck, imported: n });
});

export default cards;
