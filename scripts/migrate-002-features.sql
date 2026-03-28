-- Migration 002: Auth, Agent Memory, Self-Evolution
-- Idempotent — safe to run multiple times

-- ═══ AUTH ═══════════════════════════════════════════════════════

-- Extend users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Set admin password (sha256 of 'admin' with salt — will be updated on first login)
UPDATE users SET password_hash = 'initial' WHERE email = 'andy@macherwerkstatt.cc' AND password_hash IS NULL;

-- ═══ AGENT MEMORY ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_memory (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    context TEXT,
    relevance_score FLOAT DEFAULT 1.0,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memory_employee ON agent_memory(employee_id);
CREATE INDEX IF NOT EXISTS idx_memory_category ON agent_memory(category);

CREATE TABLE IF NOT EXISTS agent_metrics (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    avg_quality_score FLOAT,
    learnings_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metrics_employee ON agent_metrics(employee_id);

-- ═══ SELF-EVOLUTION ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS code_changes (
    id SERIAL PRIMARY KEY,
    proposed_by INTEGER REFERENCES employees(id),
    approved_by INTEGER REFERENCES users(id),
    file_path VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    old_content TEXT,
    new_content TEXT NOT NULL,
    diff_summary TEXT,
    status VARCHAR(50) DEFAULT 'proposed',
    applied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_changes_status ON code_changes(status);
