import type { Client } from '@libsql/client/web';
import type { Database } from 'sql.js';
import { initTursoSchema } from './turso-schema';

/** Pull all data from Turso into local sql.js. Called on startup. */
export async function pullFromTurso(turso: Client, db: Database): Promise<number> {
  await initTursoSchema(turso);

  // Check if Turso has data
  const count = await turso.execute('SELECT COUNT(*) as c FROM cards');
  const tursoCount = (count.rows[0]?.['c'] as number) ?? 0;
  if (tursoCount === 0) return 0;

  // Pull decks
  const decks = await turso.execute('SELECT * FROM decks');
  for (const d of decks.rows) {
    db.run('INSERT OR IGNORE INTO decks (id, name, source, created_at) VALUES (?,?,?,?)',
      [d['id'], d['name'], d['source'], d['created_at']]);
  }

  // Pull cards
  const cards = await turso.execute('SELECT * FROM cards');
  const ins = db.prepare(`INSERT OR REPLACE INTO cards (id, deck_id, question, answer, tags, category, created_at,
    fsrs_due, fsrs_stability, fsrs_difficulty, fsrs_elapsed_days, fsrs_scheduled_days, fsrs_reps, fsrs_lapses, fsrs_state, fsrs_last_review, fsrs_learning_steps)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const c of cards.rows) {
    ins.bind([c['id'], c['deck_id'], c['question'], c['answer'], c['tags'], c['category'] ?? '', c['created_at'],
      c['fsrs_due'], c['fsrs_stability'], c['fsrs_difficulty'], c['fsrs_elapsed_days'], c['fsrs_scheduled_days'], c['fsrs_reps'], c['fsrs_lapses'], c['fsrs_state'], c['fsrs_last_review'], c['fsrs_learning_steps'] ?? 0]);
    ins.step();
  }
  ins.free();

  // Pull review_logs
  const logs = await turso.execute('SELECT * FROM review_logs');
  const logIns = db.prepare(`INSERT OR IGNORE INTO review_logs (id, card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days, scheduled_days, learning_steps, review)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const l of logs.rows) {
    logIns.bind([l['id'], l['card_id'], l['rating'], l['state'], l['due'], l['stability'], l['difficulty'],
      l['elapsed_days'], l['last_elapsed_days'], l['scheduled_days'], l['learning_steps'], l['review']]);
    logIns.step();
  }
  logIns.free();

  // Pull settings
  const settings = await turso.execute('SELECT * FROM settings');
  for (const s of settings.rows) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)', [s['key'], s['value']]);
  }

  return tursoCount;
}

/** Push all local data to Turso. Called once to seed cloud from existing local DB. */
export async function pushToTurso(turso: Client, db: Database): Promise<void> {
  await initTursoSchema(turso);

  const tables = ['decks', 'cards', 'review_logs', 'settings'];
  for (const table of tables) {
    const r = db.exec(`SELECT * FROM ${table}`);
    if (r.length === 0 || r[0].values.length === 0) continue;
    const cols = r[0].columns;
    const placeholders = cols.map(() => '?').join(',');
    const colNames = cols.join(',');
    const stmt = `INSERT OR REPLACE INTO ${table} (${colNames}) VALUES (${placeholders})`;

    // Batch in groups of 20
    const batchSize = 20;
    for (let i = 0; i < r[0].values.length; i += batchSize) {
      const batch = r[0].values.slice(i, i + batchSize);
      const sqls = batch.map(row => ({ sql: stmt, args: row as (string | number | null)[] }));
      await turso.batch(sqls as unknown as string[], 'write');
    }
  }
}
