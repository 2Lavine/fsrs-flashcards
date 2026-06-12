import { Hono } from 'hono';
import { State } from 'ts-fsrs';
import { eq, and, sql, not, inArray, like } from 'drizzle-orm';
import { db } from '../db';
import { cards, decks, reviewLogs, settings } from '@fsrs/shared/schema';

function uid() { return crypto.randomUUID(); }

const routes = new Hono();

// Due cards
routes.get('/due-cards', async (c) => {
  const category = c.req.query('category');
  const deckId = c.req.query('deckId');
  const paused = c.req.query('paused')?.split(',').filter(Boolean);

  const conds = [sql`(${cards.fsrsState} = ${State.New} OR ${cards.fsrsDue} <= ${new Date().toISOString()})`];
  if (category) conds.push(eq(cards.category, category));
  if (deckId) conds.push(eq(cards.deckId, deckId));
  if (paused?.length) conds.push(not(inArray(cards.category, paused)));

  const rows = await db
    .select({
      id: cards.id, deck_id: cards.deckId, deck_name: decks.name,
      question: cards.question, answer: cards.answer,
      tags: cards.tags, category: cards.category,
      created_at: cards.createdAt,
      fsrs_due: cards.fsrsDue, fsrs_stability: cards.fsrsStability,
      fsrs_difficulty: cards.fsrsDifficulty, fsrs_elapsed_days: cards.fsrsElapsedDays,
      fsrs_scheduled_days: cards.fsrsScheduledDays, fsrs_reps: cards.fsrsReps,
      fsrs_lapses: cards.fsrsLapses, fsrs_state: cards.fsrsState,
      fsrs_last_review: cards.fsrsLastReview, fsrs_learning_steps: cards.fsrsLearningSteps,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(...conds))
    .orderBy(cards.fsrsDue)
    .all();
  return c.json({ cards: rows });
});

// All cards
routes.get('/cards', async (c) => {
  const search = c.req.query('search');
  const deckId = c.req.query('deckId');
  const conds = [];
  if (search) {
    const q = `%${search}%`;
    conds.push(sql`(${like(cards.question, q)} OR ${like(cards.answer, q)} OR ${like(cards.tags, q)} OR ${like(decks.name, q)})`);
  }
  if (deckId) conds.push(eq(cards.deckId, deckId));

  const rows = await db
    .select({
      id: cards.id, deck_id: cards.deckId, deck_name: decks.name,
      question: cards.question, answer: cards.answer,
      tags: cards.tags, category: cards.category,
      created_at: cards.createdAt,
      fsrs_due: cards.fsrsDue, fsrs_stability: cards.fsrsStability,
      fsrs_difficulty: cards.fsrsDifficulty, fsrs_elapsed_days: cards.fsrsElapsedDays,
      fsrs_scheduled_days: cards.fsrsScheduledDays, fsrs_reps: cards.fsrsReps,
      fsrs_lapses: cards.fsrsLapses, fsrs_state: cards.fsrsState,
      fsrs_last_review: cards.fsrsLastReview, fsrs_learning_steps: cards.fsrsLearningSteps,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(cards.fsrsDue)
    .all();
  return c.json({ cards: rows });
});

// Update card
routes.put('/cards/:id', async (c) => {
  const id = c.req.param('id');
  const { question, answer } = await c.req.json<{ question: string; answer: string }>();
  if (!question || !answer) return c.json({ error: 'Missing question or answer' }, 400);
  await db.update(cards).set({ question, answer }).where(eq(cards.id, id));
  return c.json({ ok: true });
});

// Delete card
routes.delete('/cards/:id', async (c) => {
  const id = c.req.param('id');
  await db.delete(reviewLogs).where(eq(reviewLogs.cardId, id));
  await db.delete(cards).where(eq(cards.id, id));
  return c.json({ ok: true });
});

// Decks
routes.get('/decks', async (c) => {
  const rows = await db.select({ id: decks.id, name: decks.name, source: decks.source })
    .from(decks).orderBy(decks.name).all();
  return c.json({ decks: rows });
});

// Categories
routes.get('/categories', async (c) => {
  const deckId = c.req.query('deckId');
  const rows = deckId
    ? await db.selectDistinct({ name: cards.category }).from(cards)
        .where(and(eq(cards.deckId, deckId), not(eq(cards.category, ''))))
        .orderBy(cards.category).all()
    : await db.selectDistinct({ name: cards.category }).from(cards)
        .where(not(eq(cards.category, '')))
        .orderBy(cards.category).all();
  return c.json({ categories: rows.map(r => r.name) });
});

// Paused categories
routes.get('/paused', async (c) => {
  const r = await db.select({ value: settings.value }).from(settings)
    .where(eq(settings.key, 'paused_categories')).get();
  try { return c.json({ paused: JSON.parse(r?.value || '[]') }); } catch { return c.json({ paused: [] }); }
});

// Toggle pause
routes.post('/paused/:cat', async (c) => {
  const cat = c.req.param('cat');
  const r = await db.select({ value: settings.value }).from(settings)
    .where(eq(settings.key, 'paused_categories')).get();
  let paused: string[] = [];
  try { paused = JSON.parse(r?.value || '[]'); } catch {}
  const idx = paused.indexOf(cat);
  if (idx >= 0) paused.splice(idx, 1); else paused.push(cat);
  await db.insert(settings).values({ key: 'paused_categories', value: JSON.stringify(paused) })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(paused) } });
  return c.json({ ok: true });
});

// Delete deck
routes.delete('/decks/:name', async (c) => {
  const name = c.req.param('name');
  const d = await db.select({ id: decks.id }).from(decks).where(eq(decks.name, name)).get();
  if (!d) return c.json({ ok: true, deleted: 0 });
  await db.delete(reviewLogs).where(eq(reviewLogs.cardId, sql`(SELECT id FROM cards WHERE deck_id = ${d.id})`));
  await db.delete(cards).where(eq(cards.deckId, d.id));
  await db.delete(decks).where(eq(decks.id, d.id));
  return c.json({ ok: true, deleted: 1 });
});

// Import — batch INSERT
routes.post('/import', async (c) => {
  const { deck, source, cards: cardList } = await c.req.json<{
    deck: string; source?: string;
    cards: { question: string; answer: string; tags?: string[]; category?: string }[];
  }>();
  if (!deck || !cardList?.length) return c.json({ error: 'Need deck + cards' }, 400);

  const now = new Date().toISOString();
  let d = await db.select({ id: decks.id }).from(decks).where(eq(decks.name, deck)).get();
  let deckId: string;
  if (d) {
    deckId = d.id;
  } else {
    deckId = uid();
    await db.insert(decks).values({ id: deckId, name: deck, source: source || '', createdAt: now });
  }

  await db.insert(cards).values(
    cardList.map(cd => ({
      id: uid(), deckId, question: cd.question, answer: cd.answer,
      tags: JSON.stringify(cd.tags || []), category: cd.category || '', createdAt: now,
      fsrsDue: now, fsrsStability: 0, fsrsDifficulty: 0,
      fsrsElapsedDays: 0, fsrsScheduledDays: 0,
      fsrsReps: 0, fsrsLapses: 0, fsrsState: State.New, fsrsLearningSteps: 0,
    }))
  );

  return c.json({ ok: true, deck, imported: cardList.length });
});

export default routes;
