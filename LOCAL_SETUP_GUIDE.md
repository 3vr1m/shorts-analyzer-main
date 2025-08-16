# 🇩🇪 Local Co-op Service Setup Guide

## Overview
This guide explains how to set up the local co-op service on your German machine to bypass YouTube bot detection for shortsanalyzer.com.

## Why This Architecture?

### The Problem:
- **Server IP**: 23.88.106.121 (Hetzner datacenter IP)
- **YouTube Detection**: YouTube recognizes Hetzner as a hosting provider
- **Bot Protection**: YouTube blocks video downloads from datacenter IPs

### The Solution:
- **Your Local Machine**: 83.27.41.204 (German residential IP)
- **ISP Connection**: Regular German internet provider
- **Bypass Detection**: YouTube treats residential IPs as legitimate users

### Architecture Flow:
```
User → shortsanalyzer.com (23.88.106.121:4001) → Your Machine (83.27.41.204:8080) → German ISP → YouTube
```

## What's Already Done on Server

✅ **Server Configuration Complete:**
- Main app configured to call `http://83.27.41.204:8080`
- All video processing requests forwarded to your machine
- No yt-dlp execution on server side
- Server only handles web interface and forwards requests

✅ **GitHub Repository Updated:**
- All code pushed to `feat/local-setup-verification` branch
- Co-op service code ready for deployment
- Docker configurations updated

## Local Machine Setup Requirements

### 1. System Requirements
```bash
# Required Software:
- Node.js (v16 or higher)
- Python 3.8+ with pip
- Git (for cloning repository)
- Internet connection (residential IP: 83.27.41.204)
```

### 2. Tool Installation
```bash
# Install yt-dlp
pip3 install yt-dlp

# Install ffmpeg
# Windows: Download from https://ffmpeg.org/download.html
# macOS: brew install ffmpeg
# Linux: sudo apt install ffmpeg

# Install Whisper
pip3 install openai-whisper

# Verify installations
yt-dlp --version
ffmpeg -version
whisper --help
```

### 3. Download and Setup Co-op Service
```bash
# Clone repository
git clone https://github.com/3vr1m/shorts-analyzer-main.git
cd shorts-analyzer-main
git checkout feat/local-setup-verification

# Navigate to co-op service
cd co-op-service

# Install dependencies
npm install

# Create environment file
cp .env .env.local
```

### 4. Environment Configuration
Create `.env` file with your settings:
```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Authentication (keep these keys)
DEV_API_KEY=dev-key-12345
ADMIN_API_KEY=admin-key-linux-server-2025

# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Tool Paths (adjust for your system)
# Windows:
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
WHISPER_PATH=whisper

# macOS/Linux:
YTDLP_PATH=/usr/local/bin/yt-dlp
FFMPEG_PATH=/usr/local/bin/ffmpeg
WHISPER_PATH=/usr/local/bin/whisper

# Processing Settings
MAX_VIDEO_DURATION=600
USE_SIMPLE_QUEUE=true

# Storage
TEMP_DIR=./temp
STORAGE_PATH=./storage
```

### 5. Network Configuration

#### Required: Port 8080 Open
Your router/firewall must allow incoming connections on port 8080:

**Option A: Router Port Forwarding (Recommended)**
```
Router Settings → Port Forwarding
- External Port: 8080
- Internal Port: 8080
- Internal IP: [Your local machine IP]
- Protocol: TCP
```

**Option B: Alternative Ports**
If port 8080 is blocked, you can use alternatives:
```env
# Change in your .env file
PORT=8081
# OR
PORT=8082
# OR
PORT=3001
```
Then update server configuration to call the new port.

**Option C: VPN/Tunnel Solution**
If port forwarding isn't possible:
```bash
# Use ngrok (free tunnel service)
npm install -g ngrok
ngrok http 8080

# This gives you a public URL like: https://abc123.ngrok.io
# Update server to call this URL instead
```

#### Security Considerations:
- **Firewall**: Only allow connections from server IP (23.88.106.121)
- **Authentication**: API keys prevent unauthorized access
- **Local Only**: Service only processes video URLs, no file access

### 6. Start the Service
```bash
# From co-op-service directory
node final-processor-app.js

# Should show:
# 🚀 Final Co-op Service running on port 8080
# ✅ Ready for production video processing!
```

### 7. Test Local Service
```bash
# Test health endpoint
curl http://localhost:8080/health

# Test from server (this is what shortsanalyzer.com does)
curl -X POST http://83.27.41.204:8080/api/process-video \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key-12345" \
  -d '{"videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Troubleshooting

### Common Issues:

#### 1. Port 8080 Not Accessible
**Problem**: Server can't reach your machine
**Solutions**:
- Check router port forwarding
- Verify firewall settings
- Try alternative port
- Use ngrok tunnel

#### 2. yt-dlp Bot Detection Still Happening
**Problem**: Even residential IP gets detected
**Solutions**:
- Update yt-dlp: `pip3 install -U yt-dlp`
- Try different videos first
- Check if your ISP uses CGNAT (shared IPs)

#### 3. Missing Tools
**Problem**: yt-dlp, ffmpeg, or whisper not found
**Solutions**:
- Verify installations with version commands
- Update PATH environment variable
- Use absolute paths in .env file

#### 4. OpenAI API Errors
**Problem**: Transcription analysis fails
**Solutions**:
- Verify OPENAI_API_KEY is correct
- Check API quota/billing
- Ensure gpt-4o-mini model access

### Alternative Solutions:

#### If Port Forwarding Impossible:
1. **Cloud Proxy**: Deploy co-op service on a cloud VM with residential-like IP
2. **VPN Solution**: Use VPN exit node in Germany
3. **Tunnel Service**: Use ngrok, cloudflare tunnel, or similar

#### If Residential IP Still Detected:
1. **Browser Cookies**: Export browser cookies and use with yt-dlp
2. **Rotating User Agents**: Implement user agent rotation
3. **Request Timing**: Add random delays between requests

## Expected Results

### Once Setup Complete:
✅ **shortsanalyzer.com**: No more bot detection errors
✅ **Video Processing**: Full pipeline working (yt-dlp → ffmpeg → whisper → GPT-4o-mini)
✅ **Real Analysis**: Complete video analysis with transcript and AI insights
✅ **Performance**: Processing happens on your machine, results returned to user

### Processing Flow:
1. User submits video URL on shortsanalyzer.com
2. Server forwards request to your German machine (83.27.41.204:8080)
3. Your machine downloads video using German residential IP
4. Local processing: extract audio → transcribe → analyze with AI
5. Results sent back to server → displayed to user
6. Bot detection bypassed using residential connection

## Support

### If You Need Different Configuration:
- **Different Port**: Update PORT in .env and notify server team
- **Different IP**: If your IP changes, notify server team immediately
- **Alternative Architecture**: If port forwarding impossible, we can implement tunnel solution

### Monitoring:
- Service logs show all processing activity
- Health endpoint shows service status
- Queue stats show processing history

---

**Status**: Server ready and waiting for your local service startup
**Next Step**: Follow setup instructions and start local co-op service
**Result**: shortsanalyzer.com will work without bot detection issues
