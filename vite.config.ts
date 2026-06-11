import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function tursoDevProxy() {
  let url: string, token: string;
  return {
    name: 'turso-dev-proxy',
    configResolved(config: Record<string, unknown>) {
      url = (config as { env: Record<string, string> }).env.VITE_TURSO_URL || '';
      token = (config as { env: Record<string, string> }).env.VITE_TURSO_AUTH_TOKEN || '';
    },
    configureServer(server: { middlewares: { use: (path: string, handler: (req: { method?: string; body?: unknown; on: (event: string, cb: (chunk: string) => void) => void }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body: string) => void }) => void) => void } }) {
      server.middlewares.use('/api/turso', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
        const chunks: string[] = [];
        req.on('data', (chunk: string) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const { sql, params } = JSON.parse(chunks.join(''));
            const { createClient } = await import('@libsql/client');
            const client = createClient({ url, authToken: token });
            const result = await client.execute({ sql, args: params ?? [] });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ rows: result.rows, columns: result.columns }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: (err as Error).message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tursoDevProxy()],
  build: { target: 'es2022', outDir: 'dist' },
});
