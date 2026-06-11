import { createClient } from '@libsql/client/web';
import type { Client } from '@libsql/client/web';

let client: Client;

export function initDB(): Client {
  const url = import.meta.env.VITE_TURSO_URL;
  const token = import.meta.env.VITE_TURSO_TOKEN;
  if (!url || !token) throw new Error('Missing VITE_TURSO_URL or VITE_TURSO_TOKEN');
  client = createClient({ url, authToken: token });
  return client;
}

export function getDB(): Client {
  return client;
}
