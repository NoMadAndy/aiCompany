-- Migration 003: Zusammenfassungen / Berichte
-- Idempotent — safe to run multiple times

CREATE TABLE IF NOT EXISTS summaries (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'project',  -- 'project' oder 'task'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    highlights JSONB DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    agent_contributions JSONB DEFAULT '[]',
    generated_by INTEGER REFERENCES employees(id) DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summaries_project ON summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_summaries_type ON summaries(type);
CREATE INDEX IF NOT EXISTS idx_summaries_created ON summaries(created_at DESC);
