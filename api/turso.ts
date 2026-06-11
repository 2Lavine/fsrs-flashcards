import { createClient } from '@libsql/client';

export default async function handler(req: { method?: string; body?: { sql?: string; params?: (string | number | null)[] } }, res: { status: (code: number) => { json: (data: unknown) => void }; setHeader: (key: string, value: string) => void }) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sql, params } = req.body || {};
  if (!sql) {
    return res.status(400).json({ error: 'Missing sql' });
  }

  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    const result = await client.execute({ sql, args: params ?? [] });
    res.status(200).json({ rows: result.rows, columns: result.columns });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
