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

-- ═══ DEPLOYED APPS ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deployed_apps (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'html',
    status VARCHAR(50) DEFAULT 'active',
    deployed_by INTEGER REFERENCES employees(id) DEFAULT 2,
    url_slug VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_status ON deployed_apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON deployed_apps(url_slug);
