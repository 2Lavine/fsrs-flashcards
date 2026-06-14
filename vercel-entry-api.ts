import { app as dataApp } from './packages/server/src/app-data';
import { app as llmApp } from './packages/server/src/app-llm';
import type { Hono } from 'hono';

function pickApp(path: string): Hono {
  const isLlm = path.startsWith('/api/llm/') || path.startsWith('/api/settings/llm');
  return isLlm ? llmApp : dataApp;
}

export default async function handler(req: any, res: any) {
  try {
    const path = req.url?.split('?')[0] || '/';
    const app = pickApp(path);

    const url = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
    }

    const init: RequestInit = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    const webReq = new Request(url, init);
    const webRes = await app.fetch(webReq);

    if (webRes.status === 404) {
      console.error(`[api] 404 for ${req.method} ${path}`);
    }

    res.status(webRes.status);
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (webRes.body) {
      const reader = webRes.body.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
      let offset = 0;
      for (const c of chunks) {
        total.set(c, offset);
        offset += c.byteLength;
      }
      res.end(Buffer.from(total));
    } else {
      res.end();
    }
  } catch (e) {
    console.error(`[api] error: ${e instanceof Error ? e.stack || e.message : e}`);
    if (!res.headersSent) res.status(500);
    res.end('Internal Server Error');
  }
}
