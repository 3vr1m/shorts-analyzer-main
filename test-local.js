#!/usr/bin/env node

// Simple test script to verify our local setup
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Local Video Analysis Setup...\n');

// Test 1: Check Node.js version
console.log('✅ Node.js:', process.version);

// Test 2: Check if .env.local exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    console.log('✅ .env.local file exists');
} else {
    console.log('❌ .env.local file missing');
}

// Test 3: Check yt-dlp
try {
    const ytdlpVersion = execSync('yt-dlp --version', { encoding: 'utf8' }).trim();
    console.log('✅ yt-dlp:', ytdlpVersion);
} catch (error) {
    console.log('❌ yt-dlp not available:', error.message);
}

// Test 4: Check ffmpeg
try {
    const ffmpegVersion = execSync('ffmpeg -version', { encoding: 'utf8' }).split('\n')[0];
    console.log('✅ ffmpeg:', ffmpegVersion);
} catch (error) {
    console.log('❌ ffmpeg not available:', error.message);
}

// Test 5: Check project dependencies
const packagePath = path.join(__dirname, 'node_modules');
if (fs.existsSync(packagePath)) {
    console.log('✅ Node modules installed');
} else {
    console.log('❌ Node modules missing - run npm install');
}

// Test 6: Test basic imports
try {
    require('next');
    console.log('✅ Next.js available');
} catch (error) {
    console.log('❌ Next.js import failed:', error.message);
}

console.log('\n🎯 Local setup verification complete!');
console.log('\nNext steps:');
console.log('1. Ensure API keys are in .env.local');
console.log('2. Run: npm run dev');
console.log('3. Test video analysis at http://localhost:3000');
