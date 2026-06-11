const BASE = '/api/turso';

export function initDB(): void {
  // Token lives server-side in Vercel Function — no client init needed
}

export async function execute(sql: string, args: (string | number | null)[] = []): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: args }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

