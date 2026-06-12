import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { llmProxyRoutes } from '@sour/llm-config/server';

import stats from './routes/stats';
import reviews from './routes/reviews';
import cards from './routes/cards';

const app = new Hono();
// CORS only needed for local dev (different port); Vercel serves from same origin
if (!process.env.VERCEL) {
  app.use('*', cors());
}

llmProxyRoutes(app);

app.route('/api', stats);
app.route('/api', reviews);
app.route('/api', cards);

export { app };
