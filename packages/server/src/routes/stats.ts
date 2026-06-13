import { Hono } from 'hono';
import { State } from 'ts-fsrs';
import { eq, and, sql, not, inArray, count, gte, lt } from 'drizzle-orm';
import { db } from '../db';
import { cards, decks, reviewLogs, settings } from '@fsrs/shared/schema';

function uid() { return crypto.randomUUID(); }

const stats = new Hono();

stats.get('/health', (c) => c.json({ ok: true }));

// Stats — single query
stats.get('/stats', async (c) => {
  const n = new Date().toISOString();
  const today = n.slice(0, 10);
  const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().slice(0, 10);

  const [r] = await db
    .select({
      total: count(cards.id),
      due: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.New} OR ${cards.fsrsDue} <= ${n} THEN 1 ELSE 0 END)`,
      newCards: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.New} THEN 1 ELSE 0 END)`,
      learning: sql<number>`SUM(CASE WHEN ${cards.fsrsState} IN (${State.Learning}, ${State.Relearning}) THEN 1 ELSE 0 END)`,
      review: sql<number>`SUM(CASE WHEN ${cards.fsrsState} = ${State.Review} THEN 1 ELSE 0 END)`,
      totalReviews: sql<number>`(SELECT COUNT(*) FROM review_logs)`,
      todayReviews: sql<number>`(SELECT COUNT(*) FROM review_logs WHERE review >= ${today} AND review < ${tomorrow})`,
      avgDifficulty: sql<number>`(SELECT AVG(fsrs_difficulty) FROM cards WHERE fsrs_state != 0)`,
    })
    .from(cards);

  return c.json({
    total: r.total ?? 0, due: r.due ?? 0,
    new: r.newCards ?? 0, learning: r.learning ?? 0, review: r.review ?? 0,
    totalReviews: r.totalReviews ?? 0, today: r.todayReviews ?? 0,
    avgDifficulty: r.avgDifficulty != null ? r.avgDifficulty.toFixed(2) : '-',
  });
});

// Streak
stats.get('/streak', async (c) => {
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
    FROM dates LEFT JOIN daily ON dates.d = daily.day
    WHERE daily.c > 0
    AND dates.d > COALESCE(
      (SELECT dates.d FROM dates LEFT JOIN daily ON dates.d = daily.day WHERE daily.c IS NULL ORDER BY dates.d DESC LIMIT 1),
      date('now', '-365 day')
    )
  `);
  return c.json({ streak: rows[0]?.streak ?? 0 });
});

// Daily counts
stats.get('/daily-counts', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const start = new Date(); start.setDate(start.getDate() - (days - 1));
  const startStr = start.toISOString().slice(0, 10);
  const rows = await db
    .select({ day: sql<string>`substr(review, 1, 10)`, c: count() })
    .from(reviewLogs)
    .where(gte(reviewLogs.review, startStr))
    .groupBy(sql`substr(review, 1, 10)`)
    .orderBy(sql`substr(review, 1, 10)`)
    .all();
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.day, r.c);

  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: { label: string; date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    result.push({ label: labels[d.getDay()], date: key, count: map.get(key) ?? 0 });
  }
  return c.json({ daily: result });
});

// Category counts
stats.get('/category-counts', async (c) => {
  const rows = await db
    .select({ name: cards.category, count: count() })
    .from(cards)
    .where(not(eq(cards.category, '')))
    .groupBy(cards.category)
    .orderBy(sql`count(*) DESC`)
    .all();
  return c.json({ categories: rows });
});

// Rating counts — GROUP BY
stats.get('/rating-counts', async (c) => {
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
  return c.json({ ratings: result });
});

// Deck counts — cards + reviews per deck
stats.get('/deck-counts', async (c) => {
  const rows = await db
    .select({
      name: decks.name,
      cardCount: count(cards.id),
      reviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM review_logs WHERE review_logs.card_id IN (SELECT id FROM cards WHERE cards.deck_id = decks.id)), 0)`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.id)
    .orderBy(sql`2 DESC`)
    .all();
  return c.json({ decks: rows });
});

export default stats;
