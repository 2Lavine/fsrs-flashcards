import { Hono } from 'hono';
import { State } from 'ts-fsrs';
import { one, all } from '../types';

const stats = new Hono();

// ─── GET /health ────────────────────────────

stats.get('/health', (c) => c.json({ ok: true }));

// ─── GET /stats ─────────────────────────────

stats.get('/stats', async (c) => {
  const now = new Date().toISOString();
  const [total, due, nc, lr, review, tr, td, avg] = await Promise.all([
    one('SELECT COUNT(*) as c FROM cards').then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New} OR fsrs_due <= ?`, [now]).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.New}`).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state IN (${State.Learning}, ${State.Relearning})`).then(r => (r?.c as number) ?? 0),
    one(`SELECT COUNT(*) as c FROM cards WHERE fsrs_state = ${State.Review}`).then(r => (r?.c as number) ?? 0),
    one('SELECT COUNT(*) as c FROM review_logs').then(r => (r?.c as number) ?? 0),
    one("SELECT COUNT(*) as c FROM review_logs WHERE date(review) = date('now')").then(r => (r?.c as number) ?? 0),
    one('SELECT AVG(fsrs_difficulty) as avg FROM cards WHERE fsrs_state != 0'),
  ]);
  return c.json({ total, due, new: nc, learning: lr, review, totalReviews: tr, today: td, avgDifficulty: avg?.avg != null ? (avg.avg as number).toFixed(2) : '-' });
});

// ─── GET /streak ────────────────────────────

stats.get('/streak', async (c) => {
  const rows = await all("SELECT DISTINCT date(review) as d FROM review_logs ORDER BY d DESC LIMIT 365");
  if (rows.length === 0) return c.json({ streak: 0 });

  const dateSet = new Set(rows.map(r => r.d as string));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (!dateSet.has(today) && !dateSet.has(yesterday)) return c.json({ streak: 0 });

  let streak = 0;
  const d = new Date(dateSet.has(today) ? today : yesterday);
  while (dateSet.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return c.json({ streak });
});

// ─── GET /daily-counts ──────────────────────

stats.get('/daily-counts', async (c) => {
  const days = 7;
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const result: { label: string; count: number }[] = [];
  const dateStrs: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateStrs.push(d.toISOString().slice(0, 10));
    result.push({ label: dayNames[d.getDay()], count: 0 });
  }

  const rows = await all(
    "SELECT date(review) as d, COUNT(*) as c FROM review_logs WHERE date(review) >= ? GROUP BY d ORDER BY d",
    [dateStrs[0]],
  );
  for (const row of rows) {
    const idx = dateStrs.indexOf(row.d as string);
    if (idx >= 0) result[idx].count = row.c as number;
  }
  return c.json({ daily: result });
});

// ─── GET /category-counts ───────────────────

stats.get('/category-counts', async (c) => {
  const rows = await all("SELECT category as name, COUNT(*) as count FROM cards WHERE category != '' GROUP BY category ORDER BY count DESC");
  return c.json({ categories: rows.map(r => ({ name: r.name as string, count: r.count as number })) });
});

// ─── GET /rating-counts ─────────────────────

stats.get('/rating-counts', async (c) => {
  const labels = ['Again','Hard','Good','Easy'];
  const rows = await all("SELECT rating, COUNT(*) as count FROM review_logs GROUP BY rating ORDER BY rating");
  const ratings = labels.map((label, i) => {
    const row = rows.find(r => (r.rating as number) === i + 1);
    return { label, count: row ? (row.count as number) : 0 };
  });
  return c.json({ ratings });
});

export default stats;
