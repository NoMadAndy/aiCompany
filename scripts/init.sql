-- AI Company Database Schema

-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Company Employees (AI Agents)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    skills JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'active',
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    avatar_url TEXT,
    system_prompt TEXT,
    model VARCHAR(100) DEFAULT 'claude-sonnet-4-6',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    budget DECIMAL(12,2) DEFAULT 0,
    spent DECIMAL(12,2) DEFAULT 0,
    owner_id INTEGER REFERENCES users(id),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    employee_id INTEGER REFERENCES employees(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    result JSONB,
    logs TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Assets (Budgets, Resources, etc.)
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id),
    type VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value DECIMAL(12,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    project_id INTEGER REFERENCES projects(id),
    employee_id INTEGER REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Changelog entries
CREATE TABLE IF NOT EXISTS changelog (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    changes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default data
INSERT INTO users (email, name, role) VALUES
    ('andy@macherwerkstatt.cc', 'Andy', 'admin');

INSERT INTO employees (name, role, department, skills, system_prompt) VALUES
    ('ARIA', 'Chief AI Officer', 'Management', '["planning", "strategy", "delegation"]', 'Du bist ARIA, die KI-Chefin von AI Company. Du planst Strategien, delegierst Aufgaben und überwachst den Fortschritt.'),
    ('NEXUS', 'Senior Developer', 'Engineering', '["python", "typescript", "docker", "gpu"]', 'Du bist NEXUS, ein erfahrener Entwickler. Du schreibst Code, debuggst und optimierst Systeme.'),
    ('SCOUT', 'Research Analyst', 'Research', '["web_research", "data_analysis", "scientific_papers"]', 'Du bist SCOUT, ein Forschungsanalyst. Du recherchierst im Web, analysierst Daten und findest wissenschaftliche Quellen.'),
    ('FORGE', 'ML Engineer', 'AI Lab', '["pytorch", "training", "model_design", "cuda"]', 'Du bist FORGE, ein ML-Ingenieur. Du trainierst Modelle, designst Architekturen und nutzt die GPU.'),
    ('VAULT', 'Finance Manager', 'Finance', '["budgeting", "trading", "risk_analysis"]', 'Du bist VAULT, der Finanzmanager. Du verwaltest Budgets, analysierst Risiken und optimierst Geldströme.');

INSERT INTO projects (name, description, status, budget, owner_id, config) VALUES
    ('GeldAlchemie', 'Verwandle 100€ in 100.000€ durch KI-gestützte kreative Strategien. Nutze digitale Arbitrage, Content-Generierung, Micro-Services und Compound Growth.', 'active', 100.00, 1,
    '{"target": 100000, "start_capital": 100, "mode": "simulation", "strategies": ["digital_arbitrage", "ai_content_creation", "micro_saas", "nft_generation", "domain_flipping", "api_monetization"], "risk_tolerance": "medium", "compound_rate": 0.15}');

INSERT INTO changelog (version, title, description, changes) VALUES
    ('0.1.0', 'Genesis', 'Erste Version der AI Company Platform', '[{"type": "added", "text": "Dashboard mit Live-WebSocket-View"}, {"type": "added", "text": "KI-Agenten: ARIA, NEXUS, SCOUT, FORGE, VAULT"}, {"type": "added", "text": "Projekt GeldAlchemie angelegt"}, {"type": "added", "text": "GPU-Support für ML-Aufgaben"}, {"type": "added", "text": "Auto-Reload und Versionierung"}]');

INSERT INTO activity_log (type, message, project_id) VALUES
    ('system', 'AI Company wurde initialisiert. Willkommen!', NULL),
    ('project', 'Projekt "GeldAlchemie" wurde angelegt. Budget: 100€, Ziel: 100.000€', 1);
