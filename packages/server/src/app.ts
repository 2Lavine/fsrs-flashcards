import { Hono } from 'hono';

import { app as dataApp } from './app-data';
import { app as llmApp } from './app-llm';

const app = new Hono();

app.route('/', dataApp);
app.route('/', llmApp);

export { app };
