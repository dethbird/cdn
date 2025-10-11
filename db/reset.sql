PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
    id            TEXT PRIMARY KEY,
    kind          TEXT NOT NULL,
    project       TEXT,
    project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
    title         TEXT,
    src_mime      TEXT NOT NULL,
    ext           TEXT NOT NULL,
    width         INTEGER,
    height        INTEGER,
    duration_sec  REAL,
    bytes         INTEGER NOT NULL,
    sha256        TEXT NOT NULL,
    url_main      TEXT NOT NULL,
    url_1200      TEXT,
    url_800       TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_project ON media(project);
CREATE INDEX IF NOT EXISTS idx_media_project_id ON media(project_id);

COMMIT;
PRAGMA foreign_keys = ON;
VACUUM;