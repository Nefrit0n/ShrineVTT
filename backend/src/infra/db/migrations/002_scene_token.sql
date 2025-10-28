BEGIN;

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gridSize INTEGER NOT NULL CHECK (gridSize BETWEEN 8 AND 256),
  widthPx INTEGER NOT NULL CHECK (widthPx > 0),
  heightPx INTEGER NOT NULL CHECK (heightPx > 0),
  mapImage TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  sceneId TEXT NOT NULL,
  ownerUserId TEXT,
  name TEXT NOT NULL,
  xCell INTEGER NOT NULL,
  yCell INTEGER NOT NULL,
  sprite TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  version INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sceneId) REFERENCES scenes(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tokens_sceneId ON tokens (sceneId);
CREATE INDEX IF NOT EXISTS idx_tokens_sceneId_updatedAt ON tokens (sceneId, updatedAt);

COMMIT;
