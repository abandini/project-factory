#!/bin/bash
# project-factory initialization script

set -e

echo "=== project-factory init ==="

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm required but not installed."; exit 1; }

# Install dependencies
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Check wrangler
if ! command -v wrangler &> /dev/null; then
  echo "Installing wrangler globally..."
  npm install -g wrangler
fi

echo "Checking Cloudflare authentication..."
wrangler whoami || echo "Not authenticated. Run 'wrangler login' first."

echo ""
echo "=== Environment Ready ==="
echo "Run 'npm run dev' for local development"
echo "Run 'npm run deploy' to deploy to Cloudflare"
