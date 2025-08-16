console.log('🔄 Starting service test...');

try {
  console.log('1. Loading dotenv...');
  require('dotenv').config();
  console.log('✅ Dotenv loaded');

  console.log('2. Loading express...');
  const express = require('express');
  console.log('✅ Express loaded');

  console.log('3. Loading logger...');
  const logger = require('./src/utils/logger');
  console.log('✅ Logger loaded');

  console.log('4. Loading queue manager...');
  const queueManager = require('./src/services/queue-manager');
  console.log('✅ Queue manager loaded');

  console.log('5. Loading monitoring...');
  const monitoring = require('./src/services/monitoring');
  console.log('✅ Monitoring loaded');

  console.log('6. Creating express app...');
  const app = express();
  console.log('✅ Express app created');

  console.log('7. Starting minimal server...');
  const server = app.listen(8080, () => {
    console.log('🚀 Test server running on port 8080');
    console.log('✅ All modules loaded successfully');
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Error during startup test:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}
