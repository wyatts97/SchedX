#!/usr/bin/env bash
# Development script for SchedX (Linux/Ubuntu)
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SchedX Development Environment...${NC}"

# Load environment variables from .env file
echo -e "${YELLOW}Loading environment variables from .env...${NC}"
if [[ -f ".env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        if [[ "$line" =~ ^[^#] ]] && [[ "$line" =~ = ]]; then
            key=$(echo "$line" | cut -d= -f1 | xargs)
            value=$(echo "$line" | cut -d= -f2- | xargs)
            export "$key=$value"
            echo -e "  ${GRAY}Set $key${NC}"
        fi
    done < .env
    echo -e "${GREEN}SUCCESS: Environment variables loaded${NC}"
else
    echo -e "${RED}ERROR: .env file not found. Run ./dev-setup.sh first${NC}"
    exit 1
fi

# Create data directory for SQLite if it doesn't exist
if [[ ! -d "data" ]]; then
    mkdir -p data
    echo -e "${GREEN}Created data directory for SQLite database${NC}"
fi

# Build shared library first
echo -e "\n${YELLOW}Building shared library...${NC}"
npm run build:shared
echo -e "${GREEN}SUCCESS: Shared library built${NC}"

# Start both app and scheduler using concurrently
echo -e "\n${YELLOW}Starting app and scheduler...${NC}"
echo -e "${CYAN}App will be available at: http://localhost:5173${NC}"
echo -e "${CYAN}Database: ./data/schedx.db (SQLite)${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"
echo "" # Empty line for better readability

# Run the dev command which uses concurrently to start both services
npm run dev
