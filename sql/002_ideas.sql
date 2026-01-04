-- Migration: Lightweight idea capture tables
-- Run: wrangler d1 execute project-factory-db --file sql/002_ideas.sql --remote

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  idea_seed TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, processing, converted
  project_id TEXT,  -- filled when converted to a full project
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS idea_context (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  kind TEXT NOT NULL,  -- link, note, file, screenshot
  content TEXT NOT NULL,  -- URL, text note, R2 key for files
  metadata_json TEXT,  -- optional: title, description, tags
  created_at TEXT NOT NULL,
  FOREIGN KEY (idea_id) REFERENCES ideas(id)
);

CREATE INDEX IF NOT EXISTS idx_ideas_user ON ideas(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_idea_context ON idea_context(idea_id);
