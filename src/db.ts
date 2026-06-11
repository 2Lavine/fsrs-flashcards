import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
// Vite handles the WASM asset via ?url — copies to dist and returns the public path
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const DB_KEY = 'fsrs-sqlite-db';

let db: Database;

export async function initDB(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const saved = localStorage.getItem(DB_KEY);
  if (saved) {
    const arr = JSON.parse(saved);
    db = new SQL.Database(new Uint8Array(arr));
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      source TEXT DEFAULT '',
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      category TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      fsrs_due TEXT NOT NULL,
      fsrs_stability REAL NOT NULL DEFAULT 0,
      fsrs_difficulty REAL NOT NULL DEFAULT 0,
      fsrs_elapsed_days REAL NOT NULL DEFAULT 0,
      fsrs_scheduled_days REAL NOT NULL DEFAULT 0,
      fsrs_reps INTEGER NOT NULL DEFAULT 0,
      fsrs_lapses INTEGER NOT NULL DEFAULT 0,
      fsrs_state INTEGER NOT NULL DEFAULT 0,
      fsrs_last_review TEXT,
      fsrs_learning_steps INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      state INTEGER NOT NULL,
      due TEXT NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days REAL NOT NULL DEFAULT 0,
      last_elapsed_days REAL NOT NULL DEFAULT 0,
      scheduled_days REAL NOT NULL DEFAULT 0,
      learning_steps INTEGER NOT NULL DEFAULT 0,
      review TEXT NOT NULL
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(fsrs_due)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cards_state ON cards(fsrs_state)');
  db.run('CREATE INDEX IF NOT EXISTS idx_logs_card ON review_logs(card_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_logs_review ON review_logs(review)');

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  // Migrations for existing databases
  try { db.run('ALTER TABLE cards ADD COLUMN category TEXT DEFAULT \'\''); } catch { /* already exists */ }

  persist();
  return db;
}

export function getDB(): Database {
  return db;
}

export function persist(): void {
  const arr = Array.from(db.export());
  localStorage.setItem(DB_KEY, JSON.stringify(arr));
}
