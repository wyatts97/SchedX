# Development script for SchedX
Write-Host "Starting SchedX Development Environment..." -ForegroundColor Green

# Load environment variables from .env file
Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
            Write-Host "  Set $key" -ForegroundColor Gray
        }
    }
    Write-Host "SUCCESS: Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "ERROR: .env file not found. Run .\dev-setup.ps1 first" -ForegroundColor Red
    exit 1
}

# Create data directory for SQLite if it doesn't exist
if (-not (Test-Path "data")) {
    New-Item -ItemType Directory -Path "data" | Out-Null
    Write-Host "Created data directory for SQLite database" -ForegroundColor Green
}

# Build shared library first
Write-Host "`nBuilding shared library..." -ForegroundColor Yellow
npm run build:shared
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build shared library" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Shared library built" -ForegroundColor Green

# Start both app and scheduler using concurrently
Write-Host "`nStarting app and scheduler..." -ForegroundColor Yellow
Write-Host "App will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Database: ./data/schedx.db (SQLite)" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host "" # Empty line for better readability

# Run the dev command which uses concurrently to start both services
npm run dev 