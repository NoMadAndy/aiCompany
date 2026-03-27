#!/bin/bash
# AI Company - Version Bump Script
# Usage: ./version-bump.sh [patch|minor|major] "Description"

cd /home/andy/aiCompany

TYPE=${1:-patch}
DESC=${2:-"Update"}

# Read current version
CURRENT=$(cat version.json | grep -o '"version": "[^"]*"' | cut -d'"' -f4)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case $TYPE in
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
DATE=$(date '+%Y-%m-%d')

# Update version.json
cat > version.json << EOF
{
  "version": "$NEW_VERSION",
  "buildDate": "$DATE",
  "codename": "Genesis"
}
EOF

echo "✅ Version: $CURRENT → $NEW_VERSION"
echo "   Datum: $DATE"
echo "   Beschreibung: $DESC"
