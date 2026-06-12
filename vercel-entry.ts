import { app } from './packages/server/src/app';

// Manual bridge: Vercel Node.js (req, res) → Hono Web fetch
export default async function handler(req: any, res: any) {
  // Build Web Request from Vercel's Node.js req
  const url = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body != null) {
    // Vercel Node.js runtime pre-parses JSON bodies into objects.
    // The Web Request constructor expects a string/ReadableStream, not a plain object.
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  const webReq = new Request(url, init);
  const webRes = await app.fetch(webReq);

  // Write Web Response to Vercel's Node.js res
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
      offset += c.length;
    }
    res.end(Buffer.from(total));
  } else {
    res.end();
  }
}
