# Comprehensive Development Setup for SchedX
Write-Host "Checking SchedX Development Environment..." -ForegroundColor Green

# Function to check if a command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Check prerequisites
Write-Host "`nChecking Prerequisites..." -ForegroundColor Yellow

if (-not (Test-Command "node")) {
    Write-Host "ERROR: Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-Host "ERROR: npm not found. Please install npm first." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "docker")) {
    Write-Host "ERROR: Docker not found. Please install Docker first." -ForegroundColor Red
    exit 1
}

Write-Host "SUCCESS: All prerequisites found" -ForegroundColor Green

# Check Node.js version
$nodeVersion = node --version
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan

# Check if .env file exists and has required variables
Write-Host "`nChecking Environment Configuration..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found. Creating from template..." -ForegroundColor Red
    
    $envContent = @"
# Development Environment Variables
# This file is for local development when running with dev.ps1 (outside Docker)
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
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-Host "SUCCESS: Created .env file" -ForegroundColor Green
} else {
    Write-Host "SUCCESS: .env file exists" -ForegroundColor Green
}

# Install dependencies
Write-Host "`nInstalling Dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Dependencies installed" -ForegroundColor Green

# Build shared library first
Write-Host "`nBuilding Shared Library..." -ForegroundColor Yellow
npm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build shared library" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Shared library built" -ForegroundColor Green

# Create data directory for SQLite
Write-Host "`nSetting up SQLite Database..." -ForegroundColor Yellow
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "SUCCESS: Created data directory for SQLite database" -ForegroundColor Green
} else {
    Write-Host "SUCCESS: Data directory already exists" -ForegroundColor Green
}

# Load environment variables from .env file
Write-Host "`nLoading Environment Variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "SUCCESS: Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "WARNING: .env file not found, using defaults" -ForegroundColor Yellow
}

# Test scheduler configuration
Write-Host "`nTesting Scheduler Configuration..." -ForegroundColor Yellow
$schedulerOutput = npm run dev:scheduler -- runOnce 2>&1
$schedulerExitCode = $LASTEXITCODE

# Check if the scheduler ran successfully
if ($schedulerExitCode -eq 0) {
    Write-Host "SUCCESS: Scheduler configuration test passed" -ForegroundColor Green
} else {
    Write-Host "WARNING: Scheduler test failed (this may be normal on first run)" -ForegroundColor Yellow
    Write-Host "The scheduler will initialize the database on first actual run." -ForegroundColor Yellow
}

# Test app configuration
Write-Host "`nTesting App Configuration..." -ForegroundColor Yellow
if (Test-Path "packages/schedx-app/package.json") {
    $packageJson = Get-Content "packages/schedx-app/package.json" | ConvertFrom-Json
    if ($packageJson.scripts.dev) {
        Write-Host "SUCCESS: App configuration test passed" -ForegroundColor Green
    } else {
        Write-Host "WARNING: No dev script found in package.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: package.json not found" -ForegroundColor Red
}

Write-Host "`nSUCCESS: Development Environment Setup Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Run: .\dev.ps1" -ForegroundColor White
Write-Host "2. Or run manually: npm run dev" -ForegroundColor White
Write-Host "`nAccess the app at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "`nNote: SQLite database will be created at ./data/schedx.db on first run" -ForegroundColor Yellow 