#!/bin/bash
# AI Company - Deploy Script
set -e

cd /home/andy/aiCompany

echo "🔄 AI Company Deploy gestartet..."

# Stop old containers on our ports if needed
echo "📦 Stoppe alte Container auf Port 3002/8002..."
docker compose down 2>/dev/null || true

# Build and start
echo "🏗️  Baue und starte Services..."
docker compose up -d --build

echo "⏳ Warte auf Gesundheitschecks..."
sleep 10

# Check health
if docker compose ps | grep -q "running"; then
    echo "✅ AI Company läuft!"
    echo "   Frontend: http://localhost:3002"
    echo "   Worker:   http://localhost:8080 (intern)"
    echo "   Live:     https://aicompany.macherwerkstatt.cc"
else
    echo "❌ Fehler beim Start. Logs:"
    docker compose logs --tail=30
    exit 1
fi
