-- Migration 004: Docker-basiertes App-Deployment
-- Erweitert deployed_apps um Container-Management-Felder
-- Idempotent — safe to run multiple times

-- Neue Spalten fuer Docker-Deployment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'container_id') THEN
        ALTER TABLE deployed_apps ADD COLUMN container_id VARCHAR(64);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'port') THEN
        ALTER TABLE deployed_apps ADD COLUMN port INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'deploy_type') THEN
        ALTER TABLE deployed_apps ADD COLUMN deploy_type VARCHAR(20) DEFAULT 'inline';
        -- 'inline' = alte Methode (HTML in DB), 'docker' = Docker-Container
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'container_status') THEN
        ALTER TABLE deployed_apps ADD COLUMN container_status VARCHAR(30) DEFAULT 'none';
        -- 'none', 'building', 'running', 'stopped', 'error'
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'docker_image') THEN
        ALTER TABLE deployed_apps ADD COLUMN docker_image VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'error_log') THEN
        ALTER TABLE deployed_apps ADD COLUMN error_log TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deployed_apps' AND column_name = 'updated_at') THEN
        ALTER TABLE deployed_apps ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Index fuer Port-Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_port ON deployed_apps(port) WHERE port IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_apps_container_status ON deployed_apps(container_status);
CREATE INDEX IF NOT EXISTS idx_apps_deploy_type ON deployed_apps(deploy_type);
