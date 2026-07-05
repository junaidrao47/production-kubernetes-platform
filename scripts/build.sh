#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-v1.0.0}"

cd "$ROOT_DIR"

echo "Building application images with version ${VERSION}"

docker build -t "todo-backend:${VERSION}" -f apps/backend/Dockerfile apps/backend
docker build -t "todo-worker:${VERSION}" -f apps/worker/Dockerfile apps/worker
docker build -t "todo-frontend:${VERSION}" -f apps/frontend/Dockerfile apps/frontend

echo
printf 'Build summary:\n'
printf '  - todo-backend:%s\n' "$VERSION"
printf '  - todo-worker:%s\n' "$VERSION"
printf '  - todo-frontend:%s\n' "$VERSION"
