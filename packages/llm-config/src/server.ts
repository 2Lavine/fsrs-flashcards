import { generateText } from 'ai';
import { createLLMProvider } from '@sour/llm-config';
import type { Hono } from 'hono';
import type { LLMConfigStorage, LLMConfig } from './index';

export function llmSettingsRoutes(app: Hono, storage: LLMConfigStorage) {
  app.get('/api/settings/llm', async (c) => {
    const configs = await storage.getAll();
    return c.json({ configs });
  });

  app.post('/api/settings/llm', async (c) => {
    const body = await c.req.json<{ configs: LLMConfig[] }>();
    if (!body.configs?.length) {
      return c.json({ error: 'Missing configs' }, 400);
    }
    await storage.saveAll(body.configs);
    return c.json({ ok: true });
  });
}

export function llmProxyRoutes(app: Hono) {
  app.post('/api/llm/fetch-models', async (c) => {
    const { baseURL, apiKey, apiFormat } = await c.req.json<{ baseURL: string; apiKey: string; apiFormat: string }>();
    const url = baseURL.replace(/\/+$/, '') + '/models';
    const headers: Record<string, string> = {};
    if (apiFormat === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return c.json({ error: `Upstream ${res.status}` }, 502);
    const data = await res.json();
    return c.json(data);
  });

  app.post('/api/llm/generate', async (c) => {
    const body = await c.req.json<LLMConfig & { system: string; prompt: string }>();
    const { baseURL, apiKey, model, apiFormat, system, prompt } = body;
    if (!baseURL || !apiKey || !model || !prompt) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    try {
      const config: LLMConfig = { baseURL, apiKey, model, apiFormat };
      const provider = createLLMProvider(config);
      const result = await generateText({
        model: provider(model),
        system,
        prompt,
      });
      return c.json({ text: result.text });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'Generation failed' }, 502);
    }
  });
}
