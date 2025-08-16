# Co-op Video Analysis Service

A high-performance Node.js service for automated video analysis using yt-dlp, FFmpeg, Whisper, and OpenAI GPT-4. This service provides comprehensive video content analysis including transcription and AI-powered insights.

## Features

- 🎥 **Video Processing**: Download and process videos from YouTube and other platforms
- 🎤 **Audio Transcription**: High-quality transcription using OpenAI Whisper
- 🧠 **AI Analysis**: Comprehensive content analysis using GPT-4
- 🔄 **Queue Management**: Redis-backed job queue with retry logic and concurrency control
- 📊 **Monitoring**: Built-in health checks, metrics, and performance monitoring
- 🔐 **Security**: API key authentication, rate limiting, and input validation
- 🪝 **Webhooks**: Real-time notifications via HTTP callbacks
- 📝 **Logging**: Structured logging with multiple transports

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Co-op API   │───▶│  Video Queue    │
│  (Frontend)     │    │   Service    │    │  (Bull/Redis)   │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                      │
                              ▼                      ▼
                    ┌──────────────┐    ┌─────────────────┐
                    │  Monitoring  │    │ Video Processor │
                    │   Service    │    │   (Pipeline)    │
                    └──────────────┘    └─────────────────┘
                                                 │
                        ┌────────────┬───────────┼───────────┐
                        ▼            ▼           ▼           ▼
                   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
                   │ yt-dlp  │ │ FFmpeg  │ │ Whisper │ │ OpenAI  │
                   │Download │ │ Audio   │ │Transcr. │ │Analysis │
                   └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## Quick Start

### Prerequisites

1. **Node.js** (v16 or higher)
2. **Redis** (for queue management)
3. **yt-dlp** (for video downloading)
4. **FFmpeg** (for audio extraction)
5. **Whisper** (for transcription)
6. **OpenAI API Key** (for content analysis)

### Installation

1. **Clone and setup the service:**
```bash
cd co-op-service
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Install external tools:**

**Windows:**
```powershell
# Install yt-dlp
pip install yt-dlp

# Install FFmpeg (download from https://ffmpeg.org/)
# Add to PATH or set FFMPEG_PATH in .env

# Install Whisper
pip install openai-whisper

# Install Redis (or use Docker)
# docker run -d -p 6379:6379 redis:alpine
```

**Linux/macOS:**
```bash
# Install yt-dlp
pip install yt-dlp

# Install FFmpeg
sudo apt install ffmpeg  # Ubuntu/Debian
brew install ffmpeg      # macOS

# Install Whisper
pip install openai-whisper

# Install Redis
sudo apt install redis-server  # Ubuntu/Debian
brew install redis             # macOS
```

4. **Start the service:**
```bash
# Development
npm run dev

# Production with PM2
npm start

# Or manually
node src/app.js
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Server
PORT=8080
NODE_ENV=development

# Authentication
ADMIN_API_KEY=your-secure-admin-key
API_KEYS=client-key-1,client-key-2

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Queue
MAX_CONCURRENT_JOBS=4
MAX_QUEUE_SIZE=100

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4

# Processing Limits
MAX_VIDEO_DURATION=600  # 10 minutes

# Tool Paths (auto-detected if in PATH)
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
WHISPER_PATH=whisper
```

## API Documentation

### Authentication

All API endpoints require authentication using API keys:

```bash
# Via Authorization header (recommended)
Authorization: Bearer your-api-key

# Via X-API-Key header
X-API-Key: your-api-key

# Via query parameter (discouraged)
?api_key=your-api-key
```

### Endpoints

#### POST /api/process-video
Submit a video for processing.

**Request:**
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "callbackUrl": "https://your-server.com/webhook",
  "options": {
    "priority": 5,
    "includeTranscript": true,
    "includeAnalysis": true,
    "webhook": "https://your-server.com/webhook"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Video processing request queued successfully",
  "data": {
    "jobId": "video_1234567890_abc123",
    "requestId": "req_xyz789",
    "status": "queued",
    "position": 3,
    "estimatedWaitTime": "15 minutes",
    "endpoints": {
      "status": "/api/queue-status?jobId=video_1234567890_abc123",
      "cancel": "/api/cancel-request"
    }
  },
  "queueInfo": {
    "waiting": 3,
    "active": 2,
    "completed": 145,
    "failed": 2
  }
}
```

#### GET /api/queue-status
Check job status or get queue overview.

**Query Parameters:**
- `jobId` (optional): Specific job ID to check
- `limit` (optional): Number of jobs to return (default: 10)
- `status` (optional): Filter by status (waiting, active, completed, failed)

**Response for specific job:**
```json
{
  "success": true,
  "data": {
    "jobId": "video_1234567890_abc123",
    "requestId": "req_xyz789",
    "status": "completed",
    "progress": 100,
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "processedAt": "2024-01-15T10:31:00.000Z",
    "finishedAt": "2024-01-15T10:35:30.000Z",
    "result": {
      "success": true,
      "analysis": { /* AI analysis results */ },
      "transcript": { /* transcription results */ },
      "metadata": { /* processing metadata */ }
    }
  }
}
```

#### POST /api/cancel-request
Cancel a pending or active job.

**Request:**
```json
{
  "jobId": "video_1234567890_abc123",
  "reason": "User requested cancellation"
}
```

#### GET /health
Service health check (no authentication required).

**Response:**
```json
{
  "healthy": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "overall": { "status": "healthy" },
    "system": { "status": "healthy" },
    "redis": { "status": "healthy" }
  },
  "issues": []
}
```

#### GET /metrics
System metrics (requires authentication).

## Processing Pipeline

The service processes videos through the following stages:

1. **Video Information Extraction**
   - Uses yt-dlp to get metadata
   - Validates video duration and accessibility

2. **Video Download**
   - Downloads video in optimal quality (max 720p for efficiency)
   - Stores temporarily for processing

3. **Audio Extraction**
   - Uses FFmpeg to extract audio as 16kHz WAV
   - Optimized for Whisper processing

4. **Transcription**
   - Uses OpenAI Whisper for speech-to-text
   - Provides timestamps and confidence scores

5. **AI Analysis**
   - Uses GPT-4 for comprehensive content analysis
   - Generates insights, themes, and recommendations

6. **Result Compilation**
   - Combines all processing results
   - Sends webhook notifications if configured

7. **Cleanup**
   - Removes temporary files
   - Updates job status

## Result Format

Completed jobs return comprehensive results:

```json
{
  "success": true,
  "jobId": "video_1234567890_abc123",
  "sessionId": "session_1705312200000_a1b2c3d4",
  "processedAt": "2024-01-15T10:35:30.000Z",
  "data": {
    "video": {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID",
      "title": "Video Title",
      "duration": 180,
      "uploader": "Channel Name",
      "viewCount": 50000,
      "likeCount": 1200,
      "description": "Video description...",
      "tags": ["tag1", "tag2"],
      "categories": ["Education"],
      "resolution": "1280x720",
      "fps": 30
    },
    "analysis": {
      "summary": "Brief summary of the video content",
      "themes": ["main theme", "secondary theme"],
      "sentiment": {
        "overall": "positive",
        "confidence": 0.85,
        "details": "The content has an optimistic tone..."
      },
      "key_topics": [
        {
          "topic": "machine learning",
          "relevance": 0.9,
          "timestamps": ["00:30", "02:45"]
        }
      ],
      "engagement_analysis": {
        "hook_quality": "strong",
        "pacing": "moderate",
        "retention_prediction": 0.78,
        "call_to_action": "present",
        "engagement_score": 8.5
      },
      "content_insights": {
        "target_audience": "Tech professionals and students",
        "content_type": "educational",
        "complexity_level": "intermediate",
        "production_quality": "high"
      },
      "optimization_suggestions": [
        "Consider adding more visual examples",
        "The introduction could be more engaging"
      ],
      "tags_suggestions": ["AI", "tutorial", "beginner-friendly"],
      "strengths": ["Clear explanation", "Good pacing"],
      "weaknesses": ["Could use more examples"]
    },
    "transcript": {
      "text": "Welcome to this tutorial on machine learning...",
      "segments": [
        {
          "start": 0.0,
          "end": 3.5,
          "text": "Welcome to this tutorial"
        }
      ],
      "language": "en",
      "duration": 180.5,
      "confidence": 0.92
    }
  },
  "metadata": {
    "processing": {
      "includeTranscript": true,
      "includeAnalysis": true,
      "hasWebhook": true
    },
    "tools": {
      "ytdlp": "yt-dlp",
      "ffmpeg": "ffmpeg",
      "whisper": "whisper",
      "openai": "gpt-4"
    },
    "performance": {
      "totalProcessingTime": 45000,
      "transcriptLength": 2500,
      "analysisTokens": 3200
    }
  }
}
```

## Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start the service
npm start

# View logs
pm2 logs co-op-service

# Monitor
pm2 monit

# Restart
pm2 restart co-op-service
```

### Using Docker

```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache ffmpeg python3 pip

# Install Python packages
RUN pip install yt-dlp openai-whisper

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8080
CMD ["node", "src/app.js"]
```

### Production Checklist

- [ ] Configure Redis with persistence
- [ ] Set up SSL/TLS termination (nginx/load balancer)
- [ ] Configure proper API keys (remove dev keys)
- [ ] Set up log rotation
- [ ] Configure monitoring alerts
- [ ] Set resource limits and scaling rules
- [ ] Configure backup strategy
- [ ] Set up firewall rules
- [ ] Configure rate limiting at load balancer level

## Performance Tuning

### Concurrency Settings
```bash
# Number of concurrent video processing jobs
MAX_CONCURRENT_JOBS=4

# Queue size limit
MAX_QUEUE_SIZE=100
```

### Memory Optimization
```bash
# Node.js memory limit
node --max-old-space-size=2048 src/app.js
```

### Tool Optimization
- Use Whisper `base` model for speed, `large` for accuracy
- Limit video resolution to 720p for processing efficiency
- Configure Redis maxmemory policy

## Monitoring and Troubleshooting

### Health Checks
- GET `/health` - Overall service health
- GET `/metrics` - Detailed metrics and performance data

### Logging
Logs are structured and written to:
- Console (development)
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/access.log` - Request logs

### Common Issues

1. **Video Download Fails**
   - Check yt-dlp version: `yt-dlp --version`
   - Update: `pip install -U yt-dlp`

2. **Transcription Fails**
   - Verify Whisper installation: `whisper --help`
   - Check audio file format and size

3. **High Memory Usage**
   - Monitor with: `pm2 monit`
   - Consider reducing MAX_CONCURRENT_JOBS

4. **Queue Stuck**
   - Check Redis connection: `redis-cli ping`
   - Clear failed jobs: `npm run queue:clean`

## API Client Examples

### JavaScript/Node.js
```javascript
const fetch = require('node-fetch');

const processVideo = async (videoUrl) => {
  const response = await fetch('http://localhost:8080/api/process-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-api-key'
    },
    body: JSON.stringify({
      videoUrl,
      options: {
        includeTranscript: true,
        includeAnalysis: true
      }
    })
  });
  
  return response.json();
};
```

### Python
```python
import requests

def process_video(video_url):
    response = requests.post(
        'http://localhost:8080/api/process-video',
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your-api-key'
        },
        json={
            'videoUrl': video_url,
            'options': {
                'includeTranscript': True,
                'includeAnalysis': True
            }
        }
    )
    return response.json()
```

### cURL
```bash
curl -X POST http://localhost:8080/api/process-video \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "options": {
      "includeTranscript": true,
      "includeAnalysis": true
    }
  }'
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, please:
1. Check the troubleshooting section
2. Review the logs for error details
3. Open an issue on GitHub with:
   - Error logs
   - Configuration details
   - Steps to reproduce

---

**Built with ❤️ for the shorts-analyzer project**
