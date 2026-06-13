import { Hono } from 'hono';
import { llmProxyRoutes } from '@sour/llm-config/server';

const app = new Hono();

llmProxyRoutes(app);

export { app };
