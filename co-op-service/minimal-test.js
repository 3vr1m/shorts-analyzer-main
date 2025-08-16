console.log('🔄 Starting minimal test...');

// Step by step loading
require('dotenv').config();
console.log('✅ Dotenv loaded');

const express = require('express');
console.log('✅ Express loaded');

const app = express();
console.log('✅ Express app created');

// Add basic middleware
app.use(express.json());
console.log('✅ JSON middleware added');

// Add a simple health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'minimal-test'
  });
});
console.log('✅ Health endpoint added');

// Start server
const PORT = 8080;
const server = app.listen(PORT, () => {
  console.log('🚀 Minimal test server running on port', PORT);
  console.log('✅ Test successful - server started!');
  
  // Exit after 2 seconds
  setTimeout(() => {
    console.log('🔒 Shutting down test server...');
    server.close(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    });
  }, 2000);
});

// Handle errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

console.log('⏳ Server starting...');
