import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";

mkdirSync("./data", { recursive: true });

const db = new Database("./data/brain.db");

// Create tables on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    source_type TEXT NOT NULL,   -- 'text' | 'pdf' | 'url' | 'voice'
    source_ref  TEXT,            -- filename, URL, etc
    raw_text    TEXT NOT NULL,
    tags        TEXT DEFAULT '[]', -- JSON array
    chunk_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id         TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    last_used  TEXT DEFAULT (datetime('now'))
  );
`);

export const notesDb = {
  insert: db.prepare(`
    INSERT INTO notes (id, title, source_type, source_ref, raw_text, tags, chunk_count)
    VALUES (@id, @title, @source_type, @source_ref, @raw_text, @tags, @chunk_count)
  `),

  getById: db.prepare(`SELECT * FROM notes WHERE id = ?`),

  getAll: db.prepare(
    `SELECT id, title, source_type, source_ref, created_at, chunk_count FROM notes ORDER BY created_at DESC`,
  ),

  delete: db.prepare(`DELETE FROM notes WHERE id = ?`),

  count: db.prepare(`SELECT COUNT(*) as total FROM notes`),
};

export { db };
