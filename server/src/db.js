// SQLite database: one file (server/data/app.db by default, or DATA_DIR/app.db).
// Schema changes are numbered migrations below; they only ever run forward, once each.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });
const db = new Database(path.join(config.dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migrations = [
  // 1: users, sessions, events, audit log
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor')),
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE events (
    id          INTEGER PRIMARY KEY,
    section     TEXT NOT NULL CHECK (section IN ('upcoming','past')),
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tag         TEXT NOT NULL DEFAULT '',
    start_date  TEXT,              -- YYYY-MM-DD, optional
    end_date    TEXT,              -- YYYY-MM-DD, optional (multi-day events)
    date_note   TEXT NOT NULL DEFAULT '',  -- shown when there is no date, e.g. "Dates to be announced", "FY26"
    location    TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',  -- site-relative path of the 16:10 image
    image_small TEXT NOT NULL DEFAULT '',  -- 800px version for phones
    image_alt   TEXT NOT NULL DEFAULT '',
    media       TEXT NOT NULL DEFAULT 'image' CHECK (media IN ('image','video')),
    published   INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX events_section ON events(section, sort_order);

  CREATE TABLE audit_log (
    id        INTEGER PRIMARY KEY,
    user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action    TEXT NOT NULL,
    entity    TEXT NOT NULL,
    entity_id INTEGER,
    detail    TEXT,
    at        TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `
];

db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
const current = (db.prepare('SELECT MAX(version) v FROM schema_version').get().v) || 0;
for (let v = current + 1; v <= migrations.length; v++) {
  db.transaction(() => {
    db.exec(migrations[v - 1]);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
  })();
}

function audit(userId, action, entity, entityId, detail) {
  db.prepare('INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?,?,?,?,?)')
    .run(userId || null, action, entity, entityId || null, detail ? JSON.stringify(detail) : null);
}

module.exports = { db, audit };
