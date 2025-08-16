# 🐳 Co-op Video Analysis Service - Docker Deployment

This guide covers deploying the Co-op Video Analysis Service using Docker, which provides a consistent, production-ready environment with all dependencies pre-installed.

## 📋 **Prerequisites**

### Windows
1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
2. **PowerShell 5.1+** (included with Windows 10/11)

### Linux/Mac
1. **Docker** - [Installation guide](https://docs.docker.com/get-docker/)
2. **Docker Compose** - [Installation guide](https://docs.docker.com/compose/install/)

## 🚀 **Quick Start**

### Windows (PowerShell)
```powershell
# Clone the repository (if not already done)
git clone <repository-url>
cd co-op-service

# Start with Docker
.\docker-start.ps1
```

### Linux/Mac (Bash)
```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd co-op-service

# Make the script executable and run
chmod +x docker-start.sh
./docker-start.sh
```

### Manual Docker Compose
```bash
# Copy environment file
cp .env.docker .env

# Edit .env file with your configuration
nano .env

# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔧 **Configuration**

### Environment Variables
The service uses a `.env` file for configuration. Key variables:

```bash
# API Keys (CHANGE THESE!)
ADMIN_API_KEY=your-secure-admin-key
DEV_API_KEY=your-dev-key
API_KEYS=client-key-1,client-key-2

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# Processing Limits
MAX_CONCURRENT_JOBS=4
MAX_QUEUE_SIZE=100
MAX_VIDEO_DURATION=600

# Server Configuration
PUBLIC_IP=your-server-ip
```

## 🌐 **Service Endpoints**

Once running, the service exposes these endpoints:

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/health` | GET | Health check | No |
| `/metrics` | GET | System metrics | Yes |
| `/api/process-video` | POST | Process video | Yes |
| `/api/queue-status` | GET | Queue status | Yes |
| `/api/cancel-request` | POST | Cancel job | Yes |

## 📊 **Monitoring & Management**

### View Service Status
```bash
# Check running containers
docker-compose ps

# View service logs
docker-compose logs -f coop-service

# View Redis logs
docker-compose logs -f redis

# Monitor resource usage
docker stats
```

### Service Management
```bash
# Stop services
docker-compose stop

# Start services
docker-compose start

# Restart services
docker-compose restart

# Stop and remove containers
docker-compose down

# Stop and remove everything including volumes
docker-compose down -v
```

### Health Checks
```bash
# Manual health check
curl http://localhost:8080/health

# Check with API key
curl -H "X-API-Key: your-api-key" http://localhost:8080/metrics
```

## 🔍 **Testing the Service**

### 1. Health Check
```bash
curl http://localhost:8080/health
```

### 2. Process a Video
```bash
curl -X POST http://localhost:8080/api/process-video \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "options": {
      "includeTranscript": true,
      "includeAnalysis": true
    }
  }'
```

### 3. Check Queue Status
```bash
curl -H "X-API-Key: your-api-key" \
  "http://localhost:8080/api/queue-status"
```

## 🐛 **Troubleshooting**

### Common Issues

#### 1. Docker Build Fails
```bash
# Clean Docker cache
docker system prune -f
docker-compose build --no-cache
```

#### 2. Service Won't Start
```bash
# Check logs
docker-compose logs coop-service

# Check if ports are available
netstat -tulpn | grep :8080
netstat -tulpn | grep :6379
```

#### 3. Redis Connection Issues
```bash
# Check Redis container
docker-compose logs redis

# Test Redis connection
docker-compose exec redis redis-cli ping
```

#### 4. API Key Issues
```bash
# Check environment variables
docker-compose exec coop-service env | grep API
```

### Log Locations

| Component | Log Location |
|-----------|--------------|
| Service | `./logs/app.log` |
| Docker | `docker-compose logs` |
| Redis | `docker-compose logs redis` |

## 🔐 **Security Considerations**

### Production Deployment
1. **Change Default API Keys** - Never use default keys in production
2. **Use HTTPS** - Deploy behind a reverse proxy with SSL
3. **Firewall Rules** - Restrict access to necessary ports only
4. **Regular Updates** - Keep Docker images updated

### API Security
- API keys are required for all processing endpoints
- Rate limiting is enabled by default
- Input validation prevents malicious requests
- Detailed logging for security monitoring

## 📈 **Scaling**

### Horizontal Scaling
```bash
# Scale the service to 3 instances
docker-compose up -d --scale coop-service=3

# Use a load balancer (nginx, traefik, etc.)
```

### Resource Limits
```yaml
# In docker-compose.yml
services:
  coop-service:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## 🔄 **Updates & Maintenance**

### Updating the Service
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

### Backup & Restore
```bash
# Backup Redis data
docker-compose exec redis redis-cli BGSAVE

# Backup logs and storage
tar -czf backup.tar.gz logs/ storage/

# Restore (copy files back and restart)
docker-compose restart
```

## 🎯 **Next Steps**

1. **Configure API Keys** - Update `.env` with secure keys
2. **Set OpenAI API Key** - Add your OpenAI API key
3. **Test Service** - Run health checks and process test videos
4. **Monitor Performance** - Check logs and metrics
5. **Production Deploy** - Use reverse proxy, SSL, monitoring

## 📞 **Support**

- **Logs**: `docker-compose logs -f`
- **Health**: `http://localhost:8080/health`
- **Metrics**: `http://localhost:8080/metrics`
- **Documentation**: See main README.md

The Docker deployment provides a complete, production-ready environment with all dependencies pre-installed and configured!
