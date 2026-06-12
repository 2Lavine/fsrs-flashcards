import { Hono } from 'hono';
import db from '../db';
import { all } from '../types';
import type { Flashcard } from '../types';

const reviews = new Hono();

// ─── POST /review ───────────────────────────

reviews.post('/review', async (c) => {
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

// ─── POST /undo ─────────────────────────────

reviews.post('/undo', async (c) => {
  const { cardId, prevFSRS } = await c.req.json<{ cardId: string; prevFSRS: Flashcard['fsrs'] }>();
  await db.execute({
    sql: 'UPDATE cards SET fsrs_due=?,fsrs_stability=?,fsrs_difficulty=?,fsrs_elapsed_days=?,fsrs_scheduled_days=?,fsrs_reps=?,fsrs_lapses=?,fsrs_state=?,fsrs_last_review=?,fsrs_learning_steps=? WHERE id=?',
    args: [prevFSRS.due, prevFSRS.stability, prevFSRS.difficulty, prevFSRS.elapsed_days, prevFSRS.scheduled_days, prevFSRS.reps, prevFSRS.lapses, prevFSRS.state, prevFSRS.last_review ?? null, prevFSRS.learning_steps, cardId],
  });
  await db.execute({ sql: 'DELETE FROM review_logs WHERE id = (SELECT id FROM review_logs WHERE card_id = ? ORDER BY review DESC LIMIT 1)', args: [cardId] });
  return c.json({ ok: true });
});

// ─── GET /recent-logs ───────────────────────

reviews.get('/recent-logs', async (c) => {
  const rows = await all(
    `SELECT rl.id, rl.card_id, rl.rating, rl.state, rl.due, rl.stability, rl.difficulty,
            rl.elapsed_days, rl.scheduled_days, rl.review, c.question
     FROM review_logs rl JOIN cards c ON rl.card_id = c.id
     ORDER BY rl.review DESC LIMIT 20`,
  );
  return c.json({ logs: rows });
});

export default reviews;
