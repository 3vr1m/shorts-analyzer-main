# Co-op Service Docker Startup Script for Windows PowerShell
# This script handles the complete Docker deployment on Windows

Write-Host "🚀 Starting Co-op Video Analysis Service with Docker..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "   Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Copy Docker environment file if .env doesn't exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from .env.docker..." -ForegroundColor Yellow
    Copy-Item ".env.docker" ".env"
    Write-Host "✅ Environment file created. Please review and update .env if needed." -ForegroundColor Green
} else {
    Write-Host "✅ Found existing .env file" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating required directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "storage" | Out-Null
New-Item -ItemType Directory -Force -Path "temp" | Out-Null

# Build and start services
Write-Host "🏗️ Building Docker images..." -ForegroundColor Yellow
docker-compose build --no-cache

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "🔄 Starting services..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start services!" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check service health
Write-Host "🔍 Checking service health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Co-op Service is running!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🌐 Service Endpoints:" -ForegroundColor Cyan
        Write-Host "   Health Check:  http://localhost:8080/health" -ForegroundColor White
        Write-Host "   Metrics:       http://localhost:8080/metrics (requires API key)" -ForegroundColor White
        Write-Host "   Process Video: http://localhost:8080/api/process-video (requires API key)" -ForegroundColor White
        Write-Host "   Queue Status:  http://localhost:8080/api/queue-status (requires API key)" -ForegroundColor White
        Write-Host ""
        Write-Host "🔑 API Keys (configured in .env):" -ForegroundColor Cyan
        Write-Host "   Admin Key:     ADMIN_API_KEY" -ForegroundColor White
        Write-Host "   Dev Key:       DEV_API_KEY" -ForegroundColor White
        Write-Host "   Client Keys:   API_KEYS" -ForegroundColor White
        Write-Host ""
        Write-Host "📊 Monitor with:" -ForegroundColor Cyan
        Write-Host "   docker-compose logs -f" -ForegroundColor White
        Write-Host "   docker-compose ps" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Service health check failed. Checking logs..." -ForegroundColor Red
    docker-compose logs --tail=20
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs coop-service" -ForegroundColor White
    Write-Host "   docker-compose restart" -ForegroundColor White
}

Write-Host ""
Write-Host "🎯 Service is ready for video analysis!" -ForegroundColor Green
Write-Host "📖 See README.md for API documentation and usage examples." -ForegroundColor Cyan

# Display current status
Write-Host ""
Write-Host "📊 Current Status:" -ForegroundColor Cyan
docker-compose ps
