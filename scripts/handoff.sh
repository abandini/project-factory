#!/bin/bash
# handoff.sh - Hand off a project-factory plan to the orchestrator
#
# Usage: ./handoff.sh <project-id> [--launch]
#
# This script:
# 1. Downloads the project plan from project-factory
# 2. Creates a project folder in ~/CascadeProjects/
# 3. Saves the plan as CLAUDE_CODE_INSTRUCTIONS.md
# 4. Adds the project to orchestrator's config.json
# 5. Optionally launches the orchestrator

set -e

API_BASE="https://project-factory.bill-burkey.workers.dev"
CASCADE_DIR="$HOME/CascadeProjects"
ORCHESTRATOR_DIR="$CASCADE_DIR/orchestrator"
ORCHESTRATOR_CONFIG="$ORCHESTRATOR_DIR/config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Project ID required${NC}"
    echo "Usage: ./handoff.sh <project-id> [--launch]"
    exit 1
fi

PROJECT_ID="$1"
LAUNCH_ORCHESTRATOR=false

if [ "$2" = "--launch" ]; then
    LAUNCH_ORCHESTRATOR=true
fi

echo -e "${YELLOW}Fetching project from project-factory...${NC}"

# Get project details
PROJECT_JSON=$(curl -s "$API_BASE/projects/$PROJECT_ID")

# Check if project exists
if echo "$PROJECT_JSON" | grep -q '"ok":false'; then
    echo -e "${RED}Error: Project not found${NC}"
    exit 1
fi

# Extract project name and create folder name (no spaces, lowercase)
PROJECT_NAME=$(echo "$PROJECT_JSON" | jq -r '.project.name')
FOLDER_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
PROJECT_DIR="$CASCADE_DIR/$FOLDER_NAME"

echo -e "${GREEN}Project: $PROJECT_NAME${NC}"
echo -e "${GREEN}Folder: $PROJECT_DIR${NC}"

# Check project status
STATUS=$(echo "$PROJECT_JSON" | jq -r '.project.status')
if [ "$STATUS" != "bootstrapped" ]; then
    echo -e "${YELLOW}Warning: Project status is '$STATUS', not 'bootstrapped'${NC}"
    echo "The project plan may be incomplete. Continue? (y/n)"
    read -r CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 0
    fi
fi

# Create project directory
if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}Directory already exists. Overwrite instructions? (y/n)${NC}"
    read -r OVERWRITE
    if [ "$OVERWRITE" != "y" ]; then
        exit 0
    fi
else
    mkdir -p "$PROJECT_DIR"
    echo -e "${GREEN}Created directory: $PROJECT_DIR${NC}"
fi

# Download the plan
echo -e "${YELLOW}Downloading project plan...${NC}"
curl -s -X POST "$API_BASE/download" \
    -H "Content-Type: application/json" \
    -d "{\"project_id\": \"$PROJECT_ID\"}" \
    > "$PROJECT_DIR/CLAUDE_CODE_INSTRUCTIONS.md"

echo -e "${GREEN}Saved: $PROJECT_DIR/CLAUDE_CODE_INSTRUCTIONS.md${NC}"

# Initialize git repo if not exists
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo -e "${YELLOW}Initializing git repository...${NC}"
    cd "$PROJECT_DIR"
    git init
    git add CLAUDE_CODE_INSTRUCTIONS.md
    git commit -m "Initial commit: project plan from project-factory"
    cd - > /dev/null
    echo -e "${GREEN}Git repository initialized${NC}"
fi

# Add to orchestrator config.json
if [ -f "$ORCHESTRATOR_CONFIG" ]; then
    echo -e "${YELLOW}Adding to orchestrator config...${NC}"

    # Check if project already exists in config
    if jq -e ".projects[] | select(.path | contains(\"$FOLDER_NAME\"))" "$ORCHESTRATOR_CONFIG" > /dev/null 2>&1; then
        echo -e "${YELLOW}Project already in orchestrator config${NC}"
    else
        # Add project to config
        TEMP_CONFIG=$(mktemp)
        jq --arg name "$FOLDER_NAME" \
           --arg path "~/CascadeProjects/$FOLDER_NAME" \
           '.projects += [{
              "name": $name,
              "path": $path,
              "repo": "",
              "instructions_file": "CLAUDE_CODE_INSTRUCTIONS.md"
           }]' "$ORCHESTRATOR_CONFIG" > "$TEMP_CONFIG"
        mv "$TEMP_CONFIG" "$ORCHESTRATOR_CONFIG"
        echo -e "${GREEN}Added to orchestrator config${NC}"
    fi
else
    echo -e "${YELLOW}Orchestrator config not found at $ORCHESTRATOR_CONFIG${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}=== Handoff Complete ===${NC}"
echo -e "Project: $PROJECT_NAME"
echo -e "Location: $PROJECT_DIR"
echo -e "Instructions: $PROJECT_DIR/CLAUDE_CODE_INSTRUCTIONS.md"
echo ""

# Launch orchestrator if requested
if [ "$LAUNCH_ORCHESTRATOR" = true ]; then
    echo -e "${YELLOW}Launching orchestrator...${NC}"
    cd "$ORCHESTRATOR_DIR"
    python orchestrator.py
else
    echo -e "To launch orchestrator: cd $ORCHESTRATOR_DIR && python orchestrator.py"
fi
