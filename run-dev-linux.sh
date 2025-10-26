#!/usr/bin/env bash
# Run SchedX dev server(s) locally on Linux (no Docker)
# Usage:
#   ./run-dev-linux.sh           # runs the web app only (@schedx/app)
#   ./run-dev-linux.sh --all     # runs web app + scheduler concurrently

set -euo pipefail

# Resolve repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# Prefer git to detect repository root if available
if command -v git >/dev/null 2>&1 && git -C "$SCRIPT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
  ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
else
  # Fallback: strip trailing /scripts if present (works for both root or scripts/)
  ROOT_DIR="${SCRIPT_DIR%/scripts}"
fi

cd "$ROOT_DIR"

# Quick sanity check: ensure we're at repo root by checking package.json with workspaces
if [[ ! -f package.json ]] || ! grep -q '"workspaces"' package.json; then
  echo "Error: Could not locate repository root (package.json with workspaces)." >&2
  echo "Current directory: $PWD" >&2
  exit 1
fi

# Minimum versions
REQUIRED_NODE_MAJOR=18
REQUIRED_NPM_MAJOR=8

function semver_major() {
  echo "$1" | awk -F. '{print $1}'
}

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js not found. Please install Node.js >= ${REQUIRED_NODE_MAJOR}.x" >&2
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/^v//')
NODE_MAJOR=$(semver_major "$NODE_VERSION")
if [[ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ]]; then
  echo "Error: Node.js v$NODE_VERSION detected. Please use Node.js >= ${REQUIRED_NODE_MAJOR}.x" >&2
  exit 1
fi

# Check npm (ensure you execute this script with bash, not sh)
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found. Please install npm >= ${REQUIRED_NPM_MAJOR}.x" >&2
  exit 1
fi
NPM_VERSION=$(npm -v)
NPM_MAJOR=$(semver_major "$NPM_VERSION")
if [[ "$NPM_MAJOR" -lt "$REQUIRED_NPM_MAJOR" ]]; then
  echo "Error: npm v$NPM_VERSION detected. Please use npm >= ${REQUIRED_NPM_MAJOR}.x" >&2
  exit 1
fi

# Install dependencies (monorepo workspaces)
echo "Installing dependencies (this may take a minute)..."
# Use ci if lockfile is present for reproducibility
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

# Validate environment and ensure required keys exist
npm run validate:env

# Optional: build shared lib first if needed by app
npm run build:shared --silent || true

MODE="app"
if [[ ${1:-} == "--all" ]]; then
  MODE="all"
fi

if [[ "$MODE" == "all" ]]; then
  echo "Starting web app and scheduler (concurrently)..."
  npm run dev
else
  echo "Starting web app dev server (@schedx/app)..."
  npm run dev:app
fi
