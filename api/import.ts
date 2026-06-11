import { createClient } from '@libsql/client';

function uid(): string {
  return crypto.randomUUID();
}

export default async function handler(req: { method?: string; body?: { deck?: string; source?: string; cards?: { question: string; answer: string; tags?: string[]; category?: string }[] } }, res: { status: (code: number) => { json: (data: unknown) => void } }) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { deck, source, cards } = req.body || {};
  if (!deck || !cards?.length) {
    return res.status(400).json({ error: 'Need deck + cards array' });
  }

  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    const deckId = uid();
    const now = new Date().toISOString();

    await client.execute({
      sql: 'INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?, ?, ?, ?)',
      args: [deckId, deck, source || '', now],
    });

    let count = 0;
    for (const c of cards) {
      const id = uid();
      const due = now; // new cards start as due immediately
      await client.execute({
        sql: `INSERT INTO cards (id, deck_id, question, answer, tags, category, created_at,
          fsrs_due, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days,
          fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review, fsrs_learning_steps)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, NULL, 0)`,
        args: [id, deckId, c.question, c.answer, JSON.stringify(c.tags || []), c.category || '', now, due],
      });
      count++;
    }

    res.status(200).json({ ok: true, deck, imported: count });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
