import { Hono } from 'hono';
import { llmProxyRoutes } from '@sour/llm-config/server';

import stats from './routes/stats';
import reviews from './routes/reviews';
import cards from './routes/cards';

const app = new Hono();

llmProxyRoutes(app);

app.route('/api', stats);
app.route('/api', reviews);
app.route('/api', cards);

export { app };
