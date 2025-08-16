# Redis Setup Guide for Windows

## 🔄 Current Status: Optional (Using Simple Queue)

The service currently works perfectly with the **simple in-memory queue** (`USE_SIMPLE_QUEUE=true`). Redis is only needed for:
- Multi-instance scaling
- Persistent job storage
- Production deployments with multiple servers

## 🚫 Redis Installation Roadblocks

### Issue: Windows Permissions
```
Error: 'C:\ProgramData\chocolatey\lib-bad' yoluna erişim reddedildi.
System.UnauthorizedAccessException: Access denied
```

### Root Cause
- Windows UAC (User Account Control) restrictions
- Chocolatey requires elevated privileges
- Package installation conflicts with existing components

## 🔧 Redis Installation Options

### Option 1: Windows Subsystem for Linux (WSL) ✅ Recommended
```bash
# Install WSL2 if not already installed
wsl --install

# In WSL, install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test Redis
redis-cli ping
# Should return: PONG
```

### Option 2: Docker Desktop ✅ Alternative
```bash
# Install Docker Desktop for Windows
# Then run Redis in container
docker run -d --name redis -p 6379:6379 redis:latest

# Test connection
docker exec -it redis redis-cli ping
```

### Option 3: Elevated Chocolatey Installation ⚠️ Requires Admin
```powershell
# Open PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force
choco install redis-64 -y

# Or try alternative Redis package
choco install memurai-developer -y
```

### Option 4: Manual Binary Installation 🔧 Advanced
```bash
# Download Redis for Windows from:
# https://github.com/microsoftarchive/redis/releases

# Extract and run
redis-server.exe
redis-cli.exe
```

## ⚙️ Service Configuration for Redis

### 1. Update Environment Variables
```env
# Enable Redis mode
USE_SIMPLE_QUEUE=false

# Redis connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Queue settings for Redis
MAX_CONCURRENT_JOBS=4
MAX_QUEUE_SIZE=100
```

### 2. Install Required Redis Dependencies
```bash
npm install bull ioredis
```

### 3. Verify Redis Connection
```javascript
// Test script: test-redis.js
const Redis = require('ioredis');
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3
});

redis.ping()
  .then(result => console.log('Redis connected:', result))
  .catch(err => console.error('Redis connection failed:', err));
```

## 🧪 Testing Redis Integration

### 1. Start Redis Service
```bash
# WSL
sudo service redis-server start

# Docker
docker start redis

# Windows Service (if installed)
net start Redis
```

### 2. Update Configuration
```env
USE_SIMPLE_QUEUE=false
```

### 3. Restart Service
```bash
npm start
```

### 4. Check Logs
```
Should see:
✅ Queue manager initialized successfully
✅ Redis connection established
```

## 🎯 When to Use Redis vs Simple Queue

### Simple Queue (Current) ✅
**Best for:**
- Single server deployment
- Development and testing
- Low to medium traffic
- Simplified setup

**Limitations:**
- Jobs lost on server restart
- No multi-instance support
- Memory-based storage only

### Redis Queue 🔄
**Best for:**
- Production environments
- Multi-server deployments
- High availability requirements
- Job persistence needed

**Benefits:**
- Jobs survive server restarts
- Horizontal scaling support
- Advanced queue features
- Production monitoring

## 🚀 Migration Path: Simple → Redis

### Step 1: Install Redis
Choose one of the options above

### Step 2: Update Configuration
```env
USE_SIMPLE_QUEUE=false
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 3: Install Dependencies
```bash
npm install bull ioredis
```

### Step 4: Test Migration
```bash
# Start service with Redis
npm start

# Verify Redis logs
# Submit test job
# Check queue persistence
```

### Step 5: Monitor Performance
- Check Redis memory usage
- Monitor connection stability
- Verify job persistence

## 🛠️ Troubleshooting Redis

### Common Issues

#### 1. Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Ensure Redis service is running

#### 2. Memory Issues
```
OOM command not allowed when used memory > 'maxmemory'
```
**Solution**: Configure Redis memory settings

#### 3. Permission Errors
```
NOAUTH Authentication required
```
**Solution**: Configure Redis password or disable auth

### Debug Commands
```bash
# Check Redis process
tasklist | findstr redis

# Test connection
redis-cli ping

# Monitor Redis logs
redis-cli monitor

# Check Redis info
redis-cli info server
```

## 📊 Performance Comparison

| Feature | Simple Queue | Redis Queue |
|---------|--------------|-------------|
| Setup Complexity | ✅ Easy | ⚠️ Moderate |
| Memory Usage | 🔄 Process RAM | 💾 External |
| Persistence | ❌ None | ✅ Disk |
| Scaling | ❌ Single | ✅ Multi |
| Monitoring | 🔍 Basic | 📊 Advanced |

## 🎯 Current Recommendation

**For now: Keep Simple Queue** ✅
- Service is fully operational
- No scaling requirements yet
- Simpler maintenance
- Windows compatibility confirmed

**Future: Migrate to Redis when needed** 🔄
- Production deployment
- Multiple server instances required
- Job persistence needed
- Advanced monitoring required

---

**Status**: Redis Optional - Simple Queue Working Perfectly
**Next Action**: Use current setup, migrate to Redis when scaling needed
