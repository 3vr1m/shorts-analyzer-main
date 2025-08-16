#!/bin/bash

# Co-op Service Docker Startup Script
# This script handles the complete Docker deployment

echo "🚀 Starting Co-op Video Analysis Service with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Copy Docker environment file if .env doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.docker..."
    cp .env.docker .env
    echo "✅ Environment file created. Please review and update .env if needed."
else
    echo "✅ Found existing .env file"
fi

# Create necessary directories
echo "📁 Creating required directories..."
mkdir -p logs storage temp

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build --no-cache

echo "🔄 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Co-op Service is running!"
    echo ""
    echo "🌐 Service Endpoints:"
    echo "   Health Check:  http://localhost:8080/health"
    echo "   Metrics:       http://localhost:8080/metrics (requires API key)"
    echo "   Process Video: http://localhost:8080/api/process-video (requires API key)"
    echo "   Queue Status:  http://localhost:8080/api/queue-status (requires API key)"
    echo ""
    echo "🔑 API Keys (configured in .env):"
    echo "   Admin Key:     ADMIN_API_KEY"
    echo "   Dev Key:       DEV_API_KEY" 
    echo "   Client Keys:   API_KEYS"
    echo ""
    echo "📊 Monitor with:"
    echo "   docker-compose logs -f"
    echo "   docker-compose ps"
else
    echo "❌ Service health check failed. Checking logs..."
    docker-compose logs --tail=20
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   docker-compose logs coop-service"
    echo "   docker-compose restart"
fi

echo ""
echo "🎯 Service is ready for video analysis!"
echo "📖 See README.md for API documentation and usage examples."
