# Development script for SchedX
Write-Host "Starting SchedX Development Environment..." -ForegroundColor Green

# Set environment variables
$env:AUTH_SECRET = "19T80r0DzwbN1xlYWVRmXuAgckkGazr2"
$env:DB_ENCRYPTION_KEY = "CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO"
$env:DATABASE_PATH = "./data/schedx.db"
$env:NODE_ENV = "development"
$env:PORT = "5173"
$env:HOST = "0.0.0.0"
$env:ORIGIN = "http://localhost:5173"
$env:MAX_UPLOAD_SIZE = "52428800"
$env:CRON_SCHEDULE = "* * * * *"

# Create data directory for SQLite if it doesn't exist
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "Created data directory for SQLite database" -ForegroundColor Green
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
Write-Host "Database: ./data/schedx.db (SQLite)" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow 