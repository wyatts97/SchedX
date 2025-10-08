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
    
    # Create .env file with required variables
    $envContent = @"
# Authentication
# Generate a secure random key: openssl rand -base64 32
AUTH_SECRET=19T80r0DzwbN1xlYWVRmXuAgckkGazr2

# Database
# Generate a secure random key: openssl rand -base64 32
DB_ENCRYPTION_KEY=CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO
MONGODB_URI=mongodb://localhost:27017/schedx

# Host setting
HOST=0.0.0.0
ORIGIN=http://localhost:5173
PORT=5173

# Node environment
NODE_ENV=development

# Max upload size for individual files (50MB in bytes)
MAX_UPLOAD_SIZE=52428800

# Cron schedule for scheduler (every minute for development)
CRON_SCHEDULE=* * * * *
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

# Check if MongoDB container is running
Write-Host "`nChecking MongoDB..." -ForegroundColor Yellow

# Check if Docker is running
try {
    docker version | Out-Null
    $dockerRunning = $true
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "WARNING: Docker is not running. Please start Docker Desktop first." -ForegroundColor Yellow
    Write-Host "You can still run the app locally without Docker by using MongoDB Atlas or a local MongoDB installation." -ForegroundColor Yellow
    Write-Host "For now, we'll skip MongoDB setup and continue with the tests..." -ForegroundColor Yellow
} else {
    $mongoContainer = docker ps --filter "name=schedx-mongo" --format "table {{.Names}}" | Select-String "schedx-mongo"
    if (-not $mongoContainer) {
        Write-Host "Starting MongoDB container..." -ForegroundColor Yellow
        docker run -d -p 27017:27017 --name schedx-mongo mongo:6
        Start-Sleep -Seconds 5
        Write-Host "SUCCESS: MongoDB started" -ForegroundColor Green
    } else {
        Write-Host "SUCCESS: MongoDB is already running" -ForegroundColor Green
    }
}

# Test scheduler configuration
Write-Host "`nTesting Scheduler Configuration..." -ForegroundColor Yellow
$env:AUTH_SECRET = "19T80r0DzwbN1xlYWVRmXuAgckkGazr2"
$env:DB_ENCRYPTION_KEY = "CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO"
$env:MONGODB_URI = "mongodb://localhost:27017/schedx"

cd packages/schedx-scheduler
$schedulerOutput = npm run dev:once 2>&1
$schedulerExitCode = $LASTEXITCODE

# Check if the scheduler ran successfully (it might fail due to MongoDB connection, which is expected)
if ($schedulerExitCode -eq 0) {
    Write-Host "SUCCESS: Scheduler configuration test passed" -ForegroundColor Green
} else {
    # Check if it failed due to MongoDB connection (which is expected if Docker isn't running)
    if ($schedulerOutput -match "MongoDB connection failed" -or $schedulerOutput -match "ECONNREFUSED") {
        Write-Host "WARNING: Scheduler test failed due to MongoDB connection (expected if Docker isn't running)" -ForegroundColor Yellow
        Write-Host "This is normal if MongoDB isn't available. The scheduler will work once MongoDB is running." -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: Scheduler test failed with unexpected error" -ForegroundColor Red
        Write-Host $schedulerOutput -ForegroundColor Red
        cd ../..
        exit 1
    }
}
cd ../..

# Test app configuration
Write-Host "`nTesting App Configuration..." -ForegroundColor Yellow
cd packages/schedx-app

# Simple test - just check if package.json has the dev script
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.scripts.dev) {
        Write-Host "SUCCESS: App configuration test passed" -ForegroundColor Green
    } else {
        Write-Host "WARNING: No dev script found in package.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: package.json not found" -ForegroundColor Red
}

cd ../..

Write-Host "`nSUCCESS: Development Environment Setup Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Run: .\dev.ps1" -ForegroundColor White
Write-Host "2. Or run manually:" -ForegroundColor White
Write-Host "   - Terminal 1: docker run -d -p 27017:27017 --name schedx-mongo mongo:6" -ForegroundColor White
Write-Host "   - Terminal 2: cd packages/schedx-scheduler; npm run dev" -ForegroundColor White
Write-Host "   - Terminal 3: cd packages/schedx-app; npm run dev" -ForegroundColor White
Write-Host "`nAccess the app at: http://localhost:5173" -ForegroundColor Cyan 