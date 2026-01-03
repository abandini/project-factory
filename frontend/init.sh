#!/bin/bash
set -e

echo "=== Project Factory UI - Init ==="

# Check Node
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js not found"
    exit 1
fi
echo "Node: $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm not found"
    exit 1
fi
echo "npm: $(npm -v)"

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Type check
echo "Running type check..."
npm run typecheck 2>/dev/null || echo "Type check script not yet configured"

# Build check
echo "Build check..."
npm run build 2>/dev/null || echo "Build not yet configured"

echo "=== Init Complete ==="
