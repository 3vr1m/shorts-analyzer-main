# Co-op Video Analysis Service Dockerfile
FROM node:18-alpine

# Install system dependencies and external tools
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    curl \
    bash \
    && pip3 install --upgrade pip

# Install yt-dlp and whisper
RUN pip3 install yt-dlp openai-whisper

# Create app directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs temp storage

# Set proper permissions
RUN chmod +x start.js

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Expose the service port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the service
CMD ["node", "src/app.js"]
