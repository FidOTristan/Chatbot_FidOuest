-- 01_create_users_table.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_name      TEXT PRIMARY KEY,           -- identifiant unique (login Windows)
  canUseApp      INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
  canImportFiles INTEGER NOT NULL DEFAULT 0,
  totalRequests  INTEGER NOT NULL DEFAULT 0 CHECK (totalRequests >= 0),
  totalRequestsWithFiles INTEGER NOT NULL DEFAULT 0 CHECK (totalRequestsWithFiles >= 0),
  totalTokens    INTEGER NOT NULL DEFAULT 0 CHECK (totalTokens >= 0),
  totalCost      REAL    NOT NULL DEFAULT 0.0 CHECK (totalCost >= 0.0),
  maxCost        REAL    NOT NULL DEFAULT 2.0 CHECK (maxCost >= 0.0)
);

-- Recommandé : index supplémentaire si tu veux des recherches partielles (pas obligatoire)
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name);

-- Exemple d’initialisation (à adapter) :
INSERT INTO users (user_name, canUseApp, canImportFiles, totalRequests, totalRequestsWithFiles, totalTokens, totalCost, maxCost)
VALUES
  ('admin', 1, 1, 0, 0, 0, 0.0, 2.0);
INSERT INTO users (user_name, canUseApp, canImportFiles, totalRequests, totalRequestsWithFiles, totalTokens, totalCost, maxCost)
VALUES
  ('tbo', 1, 1, 0, 0, 0, 0.0, 2.0);