import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { cards, reviewLogs } from '@fsrs/shared/schema';

const reviews = new Hono();

// Review
reviews.post('/review', async (c) => {
  const { cardId, rating, fsrs: f, log } = await c.req.json<{
    cardId: string; rating: number;
    fsrs: { due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review: string | null; learning_steps: number };
    log: { elapsed_days: number; last_elapsed_days: number; scheduled_days: number; learning_steps: number; review: string };
  }>();
  if (!cardId || !rating) return c.json({ error: 'Missing cardId/rating' }, 400);

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

  return c.json({ ok: true });
});

// Undo
reviews.post('/undo', async (c) => {
  const { cardId, prevFSRS: f } = await c.req.json<{
    cardId: string;
    prevFSRS: { due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; reps: number; lapses: number; state: number; last_review?: string | null; learning_steps: number };
  }>();
  await db.update(cards).set({
    fsrsDue: f.due, fsrsStability: f.stability, fsrsDifficulty: f.difficulty,
    fsrsElapsedDays: f.elapsed_days, fsrsScheduledDays: f.scheduled_days,
    fsrsReps: f.reps, fsrsLapses: f.lapses, fsrsState: f.state,
    fsrsLastReview: f.last_review ?? null, fsrsLearningSteps: f.learning_steps,
  }).where(eq(cards.id, cardId));

  await db.delete(reviewLogs).where(eq(reviewLogs.id,
    sql`(SELECT id FROM review_logs WHERE card_id = ${cardId} ORDER BY review DESC LIMIT 1)`
  ));

  return c.json({ ok: true });
});

// Recent logs
reviews.get('/recent-logs', async (c) => {
  const rows = await db
    .select({
      id: reviewLogs.id, card_id: reviewLogs.cardId, rating: reviewLogs.rating,
      state: reviewLogs.state, due: reviewLogs.due,
      stability: reviewLogs.stability, difficulty: reviewLogs.difficulty,
      elapsed_days: reviewLogs.elapsedDays, scheduled_days: reviewLogs.scheduledDays,
      review: reviewLogs.review,
      question: cards.question,
    })
    .from(reviewLogs)
    .innerJoin(cards, eq(reviewLogs.cardId, cards.id))
    .orderBy(sql`${reviewLogs.review} DESC`)
    .limit(20)
    .all();
  return c.json({ logs: rows });
});

export default reviews;
