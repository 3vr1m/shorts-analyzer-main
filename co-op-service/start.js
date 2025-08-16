#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Simple startup script for the co-op service
console.log('🚀 Starting Co-op Service...');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  No .env file found. Creating from .env.example...');
  
  const examplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ .env file created from .env.example');
    console.log('📝 Please edit .env with your configuration before starting the service');
    process.exit(0);
  } else {
    console.log('❌ .env.example file not found');
    process.exit(1);
  }
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.log(`❌ Node.js ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 8080;

console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Port: ${port}`);
console.log(`🔧 Node.js: ${nodeVersion}`);

// Check if Redis is required and available
if (!process.env.REDIS_HOST && !isDev) {
  console.log('⚠️  Redis connection not configured for production');
}

// Create required directories
const dirs = ['logs', 'temp', 'storage'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Start the application
console.log('🎬 Launching application...\n');

const app = spawn('node', ['src/app.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    FORCE_COLOR: '1' // Enable colors in logs
  }
});

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  app.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  app.kill('SIGTERM');
});

app.on('close', (code) => {
  console.log(`\n📄 Application process exited with code ${code}`);
  process.exit(code);
});

app.on('error', (err) => {
  console.error('❌ Failed to start application:', err.message);
  process.exit(1);
});
