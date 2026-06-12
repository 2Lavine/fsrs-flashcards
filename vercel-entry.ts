import { handle } from 'hono/vercel';
import { app } from './packages/server/src/app';

export default handle(app);
