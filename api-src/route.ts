import type { VercelRequest, VercelResponse } from '@vercel/node';
import { State, createEmptyCard } from 'ts-fsrs';
import { createLLMProvider } from '@sour/llm-config';
import { generateText } from 'ai';
import { eq, and, sql, inArray, not, gte, lt, count, avg } from 'drizzle-orm';
import { db } from './db';
import { cards, decks, reviewLogs, settings } from './schema';

function uid() { return crypto.randomUUID(); }
const now = () => new Date().toISOString();

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

const routes: Record<string, Handler> = {
  'GET /api/health': async (_req, res) => {
    res.json({ ok: true });
  },

  // Due cards
  'GET /api/due-cards': async (req, res) => {
    const { category, deckId, paused } = req.query;
    const pa = typeof paused === 'string' ? paused.split(',').filter(Boolean) : [];

    const conds = [
      sql`(${cards.fsrsState} = ${State.New} OR ${cards.fsrsDue} <= ${now()})`,
    ];
    if (category) conds.push(eq(cards.category, String(category)));
    if (deckId) conds.push(eq(cards.deckId, String(deckId)));
    if (pa.length) conds.push(not(inArray(cards.category, pa)));

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

    res.json({ cards: rows });
  },

  // All cards
  'GET /api/cards': async (req, res) => {
    const { search, deckId } = req.query;
    const conds = [];
    if (search) {
      const q = `%${search}%`;
      conds.push(sql`(${cards.question.like(q)} OR ${cards.answer.like(q)} OR ${cards.tags.like(q)} OR ${decks.name.like(q)})`);
    }
    if (deckId) conds.push(eq(cards.deckId, String(deckId)));

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

    res.json({ cards: rows });
  },

  // Stats — single query with Drizzle
  'GET /api/stats': async (_req, res) => {
    const n = now();
    const today = n.slice(0, 10);
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);

    const [r] = await db
      .select({
        total: count(cards.id),
        due: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.New} OR ${cards.fsrsDue} <= ${n} THEN 1 ELSE 0 END)`,
        newCards: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.New} THEN 1 ELSE 0 END)`,
        learning: sql<number>`SUM(CASE WHEN ${cards.fsrsState} IN (${State.Learning}, ${State.Relearning}) THEN 1 ELSE 0 END)`,
        review: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.Review} THEN 1 ELSE 0 END)`,
        // Subqueries for review_logs
        totalReviews: sql<number>`(SELECT COUNT(*) FROM review_logs)`,
        todayReviews: sql<number>`(SELECT COUNT(*) FROM review_logs WHERE review >= ${today} AND review < ${tomorrow})`,
        avgDifficulty: sql<number>`(SELECT AVG(fsrs_difficulty) FROM cards WHERE fsrs_state != 0)`,
      })
      .from(cards);

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json({
      total: r.total ?? 0,
      due: r.due ?? 0,
      new: r.newCards ?? 0,
      learning: r.learning ?? 0,
      review: r.review ?? 0,
      totalReviews: r.totalReviews ?? 0,
      today: r.todayReviews ?? 0,
      avgDifficulty: r.avgDifficulty != null ? r.avgDifficulty.toFixed(2) : '-',
    });
  },

  // Streak
  'GET /api/streak': async (_req, res) => {
    const r = db.run(sql`
      WITH RECURSIVE dates(d) AS (SELECT date('now') UNION ALL SELECT date(d, '-1 day') FROM dates LIMIT 365),
      daily AS (SELECT substr(review, 1, 10) as day, COUNT(*) as c FROM review_logs GROUP BY day)
      SELECT COUNT(*) as streak FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c > 0
      AND dates.d > COALESCE((SELECT dates.d FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c IS NULL ORDER BY dates.d DESC LIMIT 1), date('now', '-365 day'))
    `);
    // Raw SQL for complex CTE, use Drizzle's SQL template for parameterized query
    const rows = await db.all<{ streak: number }>(sql`
      WITH RECURSIVE dates(d) AS (
        SELECT date('now')
        UNION ALL
        SELECT date(d, '-1 day') FROM dates LIMIT 365
      ),
      daily AS (
        SELECT substr(review, 1, 10) as day, COUNT(*) as c FROM review_logs GROUP BY day
      )
      SELECT COUNT(*) as streak
      FROM dates
      LEFT JOIN daily ON dates.d = daily.day
      WHERE daily.c > 0
      AND dates.d > COALESCE(
        (SELECT dates.d FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c IS NULL ORDER BY dates.d DESC LIMIT 1),
        date('now', '-365 day')
      )
    `);
    res.json({ streak: rows[0]?.streak ?? 0 });
  },

  // Decks
  'GET /api/decks': async (_req, res) => {
    const rows = await db.select({ id: decks.id, name: decks.name, source: decks.source })
      .from(decks).orderBy(decks.name).all();
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json({ decks: rows });
  },

  // Categories
  'GET /api/categories': async (req, res) => {
    const deckId = req.query.deckId;
    const rows = deckId
      ? await db.selectDistinct({ name: cards.category }).from(cards)
          .where(and(eq(cards.deckId, String(deckId)), not(eq(cards.category, ''))))
          .orderBy(cards.category).all()
      : await db.selectDistinct({ name: cards.category }).from(cards)
          .where(not(eq(cards.category, '')))
          .orderBy(cards.category).all();
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
    res.json({ categories: rows.map(r => r.name) });
  },

  // Paused categories
  'GET /api/paused': async (_req, res) => {
    const r = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'paused_categories')).get();
    try { res.json({ paused: JSON.parse(r?.value || '[]') }); } catch { res.json({ paused: [] }); }
  },

  // Toggle pause
  'POST /api/paused/:cat': async (req, res) => {
    const cat = decodeURIComponent(req.query.cat as string || '');
    const r = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'paused_categories')).get();
    let paused: string[] = [];
    try { paused = JSON.parse(r?.value || '[]'); } catch {}
    const idx = paused.indexOf(cat);
    if (idx >= 0) paused.splice(idx, 1); else paused.push(cat);
    await db.insert(settings).values({ key: 'paused_categories', value: JSON.stringify(paused) })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(paused) } });
    res.json({ ok: true });
  },

  // Review
  'POST /api/review': async (req, res) => {
    const { cardId, rating, fsrs: f, log } = req.body || {};
    if (!cardId || !rating || !f || !log) return res.status(400).json({ error: 'Missing fields' });

    await db.update(cards).set({
      fsrsDue: f.due, fsrsStability: f.stability, fsrsDifficulty: f.difficulty,
      fsrsElapsedDays: f.elapsed_days, fsrsScheduledDays: f.scheduled_days,
      fsrsReps: f.reps, fsrsLapses: f.lapses, fsrsState: f.state,
      fsrsLastReview: f.last_review ?? null, fsrsLearningSteps: f.learning_steps,
    }).where(eq(cards.id, cardId));

    await db.insert(reviewLogs).values({
      cardId, rating, state: f.state, due: f.due,
      stability: f.stability, difficulty: f.difficulty,
      elapsedDays: log.elapsed_days, lastElapsedDays: log.last_elapsed_days,
      scheduledDays: log.scheduled_days, learningSteps: log.learning_steps,
      review: log.review,
    });

    res.json({ ok: true });
  },

  // Undo
  'POST /api/undo': async (req, res) => {
    const { cardId, prevFSRS: f } = req.body || {};
    if (!cardId || !f) return res.status(400).json({ error: 'Missing fields' });

    await db.update(cards).set({
      fsrsDue: f.due, fsrsStability: f.stability, fsrsDifficulty: f.difficulty,
      fsrsElapsedDays: f.elapsed_days, fsrsScheduledDays: f.scheduled_days,
      fsrsReps: f.reps, fsrsLapses: f.lapses, fsrsState: f.state,
      fsrsLastReview: f.last_review ?? null, fsrsLearningSteps: f.learning_steps,
    }).where(eq(cards.id, cardId));

    // Delete latest review_log for this card
    await db.delete(reviewLogs).where(eq(reviewLogs.id,
      sql`(SELECT id FROM review_logs WHERE card_id = ${cardId} ORDER BY review DESC LIMIT 1)`
    ));

    res.json({ ok: true });
  },

  // Update card
  'PUT /api/cards/:id': async (req, res) => {
    const id = req.query.id as string;
    const { question, answer } = req.body || {};
    if (!question || !answer) return res.status(400).json({ error: 'Missing question or answer' });
    await db.update(cards).set({ question, answer }).where(eq(cards.id, id));
    res.json({ ok: true });
  },

  // Delete card
  'DELETE /api/cards/:id': async (req, res) => {
    const id = req.query.id as string;
    await db.delete(reviewLogs).where(eq(reviewLogs.cardId, id));
    await db.delete(cards).where(eq(cards.id, id));
    res.json({ ok: true });
  },

  // Delete deck
  'DELETE /api/decks/:name': async (req, res) => {
    const name = decodeURIComponent(req.query.name as string);
    const d = await db.select({ id: decks.id }).from(decks).where(eq(decks.name, name)).get();
    if (!d) return res.json({ ok: true, deleted: 0 });
    await db.delete(reviewLogs).where(eq(reviewLogs.cardId, sql`(SELECT id FROM cards WHERE deck_id = ${d.id})`));
    await db.delete(cards).where(eq(cards.deckId, d.id));
    await db.delete(decks).where(eq(decks.id, d.id));
    res.json({ ok: true, deleted: 1 });
  },

  // Import — batch INSERT
  'POST /api/import': async (req, res) => {
    const { deck, source, cards: cardList } = req.body || {};
    if (!deck || !cardList?.length) return res.status(400).json({ error: 'Need deck + cards' });
    const n = now();

    let d = await db.select({ id: decks.id }).from(decks).where(eq(decks.name, deck)).get();
    let deckId: string;
    if (d) {
      deckId = d.id;
    } else {
      deckId = uid();
      await db.insert(decks).values({ id: deckId, name: deck, source: source || '', createdAt: n });
    }

    await db.insert(cards).values(
      cardList.map((c: { question: string; answer: string; tags?: string[]; category?: string }) => ({
        id: uid(), deckId, question: c.question, answer: c.answer,
        tags: JSON.stringify(c.tags || []), category: c.category || '', createdAt: n,
        fsrsDue: n, fsrsStability: 0, fsrsDifficulty: 0,
        fsrsElapsedDays: 0, fsrsScheduledDays: 0,
        fsrsReps: 0, fsrsLapses: 0, fsrsState: State.New, fsrsLearningSteps: 0,
      }))
    );

    res.json({ ok: true, deck, imported: cardList.length });
  },

  // Daily counts — GROUP BY
  'GET /api/daily-counts': async (_req, res) => {
    const start = new Date(); start.setDate(start.getDate() - 6);
    const startStr = start.toISOString().slice(0, 10);
    const rows = await db
      .select({ day: sql<string>`substr(review, 1, 10)`, c: count() })
      .from(reviewLogs)
      .where(gte(reviewLogs.review, startStr))
      .groupBy(sql`substr(review, 1, 10)`)
      .orderBy(sql`day`)
      .all();
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.day, r.c);
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts: { label: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      counts.push({ label: labels[d.getDay()], count: map.get(key) ?? 0 });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ daily: counts });
  },

  // Recent logs
  'GET /api/recent-logs': async (_req, res) => {
    const rows = await db
      .select({
        id: reviewLogs.id, card_id: reviewLogs.cardId, rating: reviewLogs.rating,
        state: reviewLogs.state, due: reviewLogs.due,
        stability: reviewLogs.stability, difficulty: reviewLogs.difficulty,
        elapsed_days: reviewLogs.elapsedDays, review: reviewLogs.review,
        question: cards.question,
      })
      .from(reviewLogs)
      .leftJoin(cards, eq(reviewLogs.cardId, cards.id))
      .orderBy(sql`${reviewLogs.review} DESC`)
      .limit(30)
      .all();
    res.json({ logs: rows });
  },

  // Category counts
  'GET /api/category-counts': async (_req, res) => {
    const rows = await db
      .select({ name: cards.category, count: count() })
      .from(cards)
      .where(not(eq(cards.category, '')))
      .groupBy(cards.category)
      .orderBy(sql`count DESC`)
      .all();
    res.json({ categories: rows });
  },

  // Rating counts — GROUP BY
  'GET /api/rating-counts': async (_req, res) => {
    const labels: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    const rows = await db
      .select({ rating: reviewLogs.rating, c: count() })
      .from(reviewLogs)
      .groupBy(reviewLogs.rating)
      .all();
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.rating, r.c);
    const result: { label: string; count: number }[] = [];
    for (let i = 1; i <= 4; i++) {
      result.push({ label: labels[i], count: map.get(i) ?? 0 });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ ratings: result });
  },

  // LLM proxy
  'POST /api/llm/fetch-models': async (req, res) => {
    const { baseURL, apiKey, apiFormat } = req.body || {};
    const url = baseURL.replace(/\/+$/, '') + '/models';
    const headers: Record<string, string> = {};
    if (apiFormat === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const r = await fetch(url, { headers });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const data = await r.json();
    res.json(data);
  },

  'POST /api/llm/generate': async (req, res) => {
    const { baseURL, apiKey, model, apiFormat, system, prompt } = req.body || {};
    if (!baseURL || !apiKey || !model || !prompt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
      const provider = createLLMProvider({ baseURL, apiKey, model, apiFormat: apiFormat || 'openai' });
      const result = await generateText({ model: provider(model), system, prompt });
      res.json({ text: result.text });
    } catch (e) {
      res.status(502).json({ error: e instanceof Error ? e.message : 'Generation failed' });
    }
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let path = req.url?.split('?')[0] || '/';
  let key = `${req.method} ${path}`;

  if (routes[key]) return routes[key](req, res);

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
