#!/usr/bin/env bash
# Comprehensive Development Setup for SchedX (Linux/Ubuntu)
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking SchedX Development Environment...${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}Checking Prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}ERROR: Node.js not found. Please install Node.js 18+ first.${NC}"
    echo "  Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}ERROR: npm not found. Please install npm first.${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}ERROR: Docker not found. Please install Docker first.${NC}"
    echo "  Ubuntu: sudo apt-get install docker.io && sudo usermod -aG docker \$USER"
    exit 1
fi

echo -e "${GREEN}SUCCESS: All prerequisites found${NC}"

# Check Node.js version
NODE_VERSION=$(node --version)
echo -e "${CYAN}Node.js version: $NODE_VERSION${NC}"

NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 18 ]]; then
    echo -e "${RED}ERROR: Node.js 18+ required. Found: $NODE_VERSION${NC}"
    exit 1
fi

# Check if .env file exists and has required variables
echo -e "\n${YELLOW}Checking Environment Configuration...${NC}"

if [[ ! -f ".env" ]]; then
    echo -e "${RED}ERROR: .env file not found. Creating from template...${NC}"
    
    cat > .env << 'EOF'
# Development Environment Variables
# This file is for local development when running with dev.sh (outside Docker)
# For Docker deployment, use .env.docker

# Authentication
# Generate a secure random key: openssl rand -base64 32
AUTH_SECRET=19T80r0DzwbN1xlYWVRmXuAgckkGazr2

# Database - SQLite for local development
# Generate a secure random key: openssl rand -base64 32
DB_ENCRYPTION_KEY=CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO
DATABASE_PATH=./data/schedx.db

# Host setting - localhost for local development
HOST=0.0.0.0
ORIGIN=http://localhost:5173
PORT=5173

# Node environment - development for local dev
NODE_ENV=development

# Max upload size for individual files (50MB in bytes)
MAX_UPLOAD_SIZE=52428800
EOF
    
    echo -e "${GREEN}SUCCESS: Created .env file${NC}"
else
    echo -e "${GREEN}SUCCESS: .env file exists${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}Installing Dependencies...${NC}"
npm install
echo -e "${GREEN}SUCCESS: Dependencies installed${NC}"

# Build shared library first
echo -e "\n${YELLOW}Building Shared Library...${NC}"
npm run build:shared
echo -e "${GREEN}SUCCESS: Shared library built${NC}"

# Create data directory for SQLite
echo -e "\n${YELLOW}Setting up SQLite Database...${NC}"
if [[ ! -d "data" ]]; then
    mkdir -p data
    echo -e "${GREEN}SUCCESS: Created data directory for SQLite database${NC}"
else
    echo -e "${GREEN}SUCCESS: Data directory already exists${NC}"
fi

# Load environment variables from .env file
echo -e "\n${YELLOW}Loading Environment Variables...${NC}"
if [[ -f ".env" ]]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}SUCCESS: Environment variables loaded${NC}"
else
    echo -e "${YELLOW}WARNING: .env file not found, using defaults${NC}"
fi

# Test scheduler configuration
echo -e "\n${YELLOW}Testing Scheduler Configuration...${NC}"
if npm run dev:scheduler -- runOnce 2>&1; then
    echo -e "${GREEN}SUCCESS: Scheduler configuration test passed${NC}"
else
    echo -e "${YELLOW}WARNING: Scheduler test failed (this may be normal on first run)${NC}"
    echo -e "${YELLOW}The scheduler will initialize the database on first actual run.${NC}"
fi

# Test app configuration
echo -e "\n${YELLOW}Testing App Configuration...${NC}"
if [[ -f "packages/schedx-app/package.json" ]]; then
    if grep -q '"dev"' packages/schedx-app/package.json; then
        echo -e "${GREEN}SUCCESS: App configuration test passed${NC}"
    else
        echo -e "${YELLOW}WARNING: No dev script found in package.json${NC}"
    fi
else
    echo -e "${RED}ERROR: package.json not found${NC}"
fi

echo -e "\n${GREEN}SUCCESS: Development Environment Setup Complete!${NC}"
echo -e "\n${CYAN}Next Steps:${NC}"
echo -e "${WHITE}1. Run: ./dev.sh${NC}"
echo -e "${WHITE}2. Or run manually: npm run dev${NC}"
echo -e "\n${CYAN}Access the app at: http://localhost:5173${NC}"
echo -e "\n${YELLOW}Note: SQLite database will be created at ./data/schedx.db on first run${NC}"
