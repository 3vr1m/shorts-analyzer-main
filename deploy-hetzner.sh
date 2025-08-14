#!/bin/bash

# Hetzner Deployment Script for Shorts Analyzer
# This script sets up the complete infrastructure on a fresh Hetzner server

set -e

echo "🚀 Starting Hetzner deployment for Shorts Analyzer..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="shorts-analyzer"
DOMAIN="${1:-localhost}"
DB_USER="shorts_user"
DB_PASSWORD=$(openssl rand -base64 32)

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   App Name: $APP_NAME"
echo "   Domain: $DOMAIN"
echo "   Database User: $DB_USER"
echo "   Database Password: $DB_PASSWORD"

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
apt update && apt upgrade -y

# Install required packages
echo -e "${YELLOW}📦 Installing required packages...${NC}"
apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
echo -e "${YELLOW}🐳 Installing Docker...${NC}"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Install Docker Compose
echo -e "${YELLOW}🐳 Installing Docker Compose...${NC}"
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Create application directory
echo -e "${YELLOW}📁 Creating application directory...${NC}"
mkdir -p /opt/$APP_NAME
cd /opt/$APP_NAME

# Create environment file
echo -e "${YELLOW}🔐 Creating environment configuration...${NC}"
cat > .env << EOF
# Database Configuration
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

# API Keys (you'll need to fill these in)
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
YOUTUBE_API_KEY=your_youtube_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
ADMIN_API_KEY=your_admin_api_key_here
ADMIN_SECRET=your_admin_secret_here

# App Configuration
NODE_ENV=production
PORT=3000
EOF

# Create directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p uploads logs/nginx ssl

# Generate self-signed SSL certificate (for testing)
echo -e "${YELLOW}🔒 Generating self-signed SSL certificate...${NC}"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

# Set proper permissions
chmod 600 ssl/key.pem
chmod 644 ssl/cert.pem

# Create database initialization script
echo -e "${YELLOW}🗄️ Creating database initialization script...${NC}"
cat > init.sql << EOF
-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS shorts_analyzer;
GRANT ALL PRIVILEGES ON DATABASE shorts_analyzer TO $DB_USER;

-- Connect to the database
\c shorts_analyzer;

-- Create tables for monitoring and analytics
CREATE TABLE IF NOT EXISTS performance_logs (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    duration INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    platform VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_logs (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    error TEXT NOT NULL,
    stack TEXT,
    ip VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_performance_logs_timestamp ON performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_logs_endpoint ON performance_logs(endpoint);
EOF

# Create systemd service
echo -e "${YELLOW}⚙️ Creating systemd service...${NC}"
cat > /etc/systemd/system/$APP_NAME.service << EOF
[Unit]
Description=Shorts Analyzer Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/$APP_NAME
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable $APP_NAME
systemctl start $APP_NAME

# Create firewall rules
echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create monitoring script
echo -e "${YELLOW}📊 Creating monitoring script...${NC}"
cat > /opt/$APP_NAME/monitor.sh << 'EOF'
#!/bin/bash

# Simple monitoring script
echo "=== Shorts Analyzer Status ==="
echo "Time: $(date)"
echo ""

# Check Docker containers
echo "Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check system resources
echo "System Resources:"
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')%"
echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"
echo ""

# Check application health
echo "Application Health:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}, Response Time: %{time_total}s\n" https://localhost/health || echo "Application not responding"
EOF

chmod +x /opt/$APP_NAME/monitor.sh

# Create backup script
echo -e "${YELLOW}💾 Creating backup script...${NC}"
cat > /opt/$APP_NAME/backup.sh << 'EOF'
#!/bin/bash

# Backup script for Shorts Analyzer
BACKUP_DIR="/opt/shorts-analyzer/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

echo "Creating backup: $DATE"

# Backup database
docker exec shorts-analyzer-postgres-1 pg_dump -U shorts_user shorts_analyzer > $BACKUP_DIR/db_backup_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/

# Backup logs
tar -czf $BACKUP_DIR/logs_backup_$DATE.tar.gz logs/

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x /opt/$APP_NAME/backup.sh

# Create cron jobs
echo -e "${YELLOW}⏰ Setting up cron jobs...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/$APP_NAME/backup.sh") | crontab -
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/$APP_NAME/monitor.sh >> /opt/$APP_NAME/logs/monitoring.log 2>&1") | crontab -

# Final status check
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
sleep 10

if systemctl is-active --quiet $APP_NAME; then
    echo -e "${GREEN}✅ Service is running successfully!${NC}"
else
    echo -e "${RED}❌ Service failed to start${NC}"
    systemctl status $APP_NAME
    exit 1
fi

# Display final information
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Edit /opt/$APP_NAME/.env with your API keys"
echo "2. Restart the service: systemctl restart $APP_NAME"
echo "3. Access your app at: https://$DOMAIN"
echo "4. Check logs: docker-compose logs -f"
echo "5. Monitor status: /opt/$APP_NAME/monitor.sh"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "   Start service: systemctl start $APP_NAME"
echo "   Stop service: systemctl stop $APP_NAME"
echo "   Restart service: systemctl restart $APP_NAME"
echo "   View logs: journalctl -u $APP_NAME -f"
echo "   Check status: systemctl status $APP_NAME"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   - Update .env file with your actual API keys"
echo "   - Configure your domain DNS to point to this server"
echo "   - Consider using Let's Encrypt for production SSL certificates"
echo "   - Set up regular backups and monitoring"
echo ""
echo -e "${GREEN}🚀 Your Shorts Analyzer is ready for action!${NC}"
