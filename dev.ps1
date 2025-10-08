# Development script for SchedX
Write-Host "Starting SchedX Development Environment..." -ForegroundColor Green

# Set environment variables
$env:AUTH_SECRET = "19T80r0DzwbN1xlYWVRmXuAgckkGazr2"
$env:DB_ENCRYPTION_KEY = "CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO"
$env:MONGODB_URI = "mongodb://localhost:27017/schedx"
$env:NODE_ENV = "development"
$env:PORT = "5173"
$env:HOST = "0.0.0.0"
$env:ORIGIN = "http://localhost:5173"
$env:MAX_UPLOAD_SIZE = "52428800"
$env:CRON_SCHEDULE = "* * * * *"

# Check if MongoDB is running
$mongoContainer = $null

# Check if Docker is running
try {
    docker version | Out-Null
    $dockerRunning = $true
    $mongoContainer = docker ps --filter "name=schedx-mongo" --format "table {{.Names}}" | Select-String "schedx-mongo"
} catch {
    $dockerRunning = $false
}

if (-not $dockerRunning) {
    Write-Host "WARNING: Docker is not running. Please start Docker Desktop first." -ForegroundColor Yellow
    Write-Host "You can still run the app locally without Docker by using MongoDB Atlas or a local MongoDB installation." -ForegroundColor Yellow
    Write-Host "Continuing with app and scheduler startup..." -ForegroundColor Yellow
} elseif (-not $mongoContainer) {
    Write-Host "Starting MongoDB container..." -ForegroundColor Yellow
    docker run -d -p 27017:27017 --name schedx-mongo mongo:6
    Start-Sleep -Seconds 5
    Write-Host "SUCCESS: MongoDB started" -ForegroundColor Green
} else {
    Write-Host "SUCCESS: MongoDB is already running" -ForegroundColor Green
}

# Build shared library first
Write-Host "Building shared library..." -ForegroundColor Yellow
npm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build shared library" -ForegroundColor Red
    exit 1
}

# Start the scheduler in background
Write-Host "Starting scheduler..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages/schedx-scheduler; npm run dev"

# Wait a moment for scheduler to start
Start-Sleep -Seconds 3

# Start the SvelteKit app in background
Write-Host "Starting SvelteKit app..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd packages/schedx-app; npm run dev"

Write-Host "`nSUCCESS: Development environment started!" -ForegroundColor Green
Write-Host "App: http://localhost:5173" -ForegroundColor Cyan
Write-Host "MongoDB: localhost:27017" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow 