import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { llmProxyRoutes } from '@sour/llm-config/server';

import stats from './routes/stats';
import reviews from './routes/reviews';
import cards from './routes/cards';

const app = new Hono();
app.use('*', cors());

// LLM proxy routes (fetch models, generate)
llmProxyRoutes(app);

// Mount route groups
app.route('/api', stats);
app.route('/api', reviews);
app.route('/api', cards);

const port = parseInt(process.env.PORT || '3001');
serve({ fetch: app.fetch, port });
console.log(`Server running on http://localhost:${port}`);
