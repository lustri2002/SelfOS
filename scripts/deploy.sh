#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${SELFOS_DEPLOY_HOST:?Set SELFOS_DEPLOY_HOST, for example deploy@example.com}"
REMOTE_DIR="${SELFOS_DEPLOY_DIR:-/opt/selfos}"
SSH_KEY="${SELFOS_DEPLOY_KEY:-$HOME/.ssh/id_ed25519}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Deploying SelfOS to ${REMOTE_HOST}:${REMOTE_DIR}"

rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  -e "ssh -i ${SSH_KEY}" \
  "${ROOT_DIR}/" \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh -i "${SSH_KEY}" "${REMOTE_HOST}" \
  "cd '${REMOTE_DIR}' && npm ci && npm run build && pm2 restart selfos"

echo "Deploy complete."
