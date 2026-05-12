import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.SQLITE_PATH?.trim() || join(dataDir, 'second-brain.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_ref TEXT NOT NULL DEFAULT '',
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/** Align with top-level `src/db.js` notes table (raw_text, tags). */
function migrateNotesColumns(): void {
  const cols = db.prepare(`PRAGMA table_info(notes)`).all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('raw_text')) {
    db.exec(`ALTER TABLE notes ADD COLUMN raw_text TEXT NOT NULL DEFAULT ''`);
  }
  if (!names.has('tags')) {
    db.exec(`ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  }
}

migrateNotesColumns();

const insertNote = db.prepare(
  `INSERT OR REPLACE INTO notes (id, title, source_type, source_ref, raw_text, tags, chunk_count, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
);

const selectAllNotes = db.prepare(
  `SELECT id, title, source_type AS sourceType, source_ref AS sourceRef,
          chunk_count AS chunkCount, created_at AS createdAt
   FROM notes ORDER BY datetime(created_at) DESC`,
);

const countNotes = db.prepare(`SELECT COUNT(*) AS count FROM notes`);

const deleteNote = db.prepare(`DELETE FROM notes WHERE id = ?`);

export type NoteRow = {
  id: string;
  title: string;
  sourceType: string;
  sourceRef: string;
  chunkCount: number;
  createdAt: string;
};

export function insertNoteRow(
  id: string,
  title: string,
  sourceType: string,
  sourceRef: string,
  chunkCount: number,
  rawText: string,
  tagsJson: string,
): void {
  insertNote.run(id, title, sourceType, sourceRef, rawText, tagsJson, chunkCount);
}

export function getAllNotes(): NoteRow[] {
  return selectAllNotes.all() as NoteRow[];
}

export function getNotesCount(): number {
  const row = countNotes.get() as { count: number } | undefined;
  return row?.count ?? 0;
}

export function deleteNoteRow(id: string): void {
  deleteNote.run(id);
}
