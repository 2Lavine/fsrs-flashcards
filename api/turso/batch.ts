import { createClient } from '@libsql/client';

export default async function handler(req: { method?: string; body?: { statements?: { sql: string; args: (string | number | null)[] }[] } }, res: { status: (code: number) => { json: (data: unknown) => void } }) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { statements } = req.body || {};
  if (!statements?.length) return res.status(400).json({ error: 'Missing statements' });

  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    const results: { rows: unknown[]; columns: string[] }[] = [];
    for (const s of statements) {
      const r = await client.execute({ sql: s.sql, args: (s.args ?? []) as (string | number)[] });
      results.push({ rows: r.rows, columns: r.columns });
    }
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
