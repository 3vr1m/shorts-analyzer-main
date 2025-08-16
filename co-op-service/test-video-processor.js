/**
 * Debug test to isolate VideoProcessor behavior
 * This helps us understand what's happening without the queue system
 */
// Load environment variables
require('dotenv').config();

const VideoProcessor = require('./src/services/video-processor');

async function testVideoProcessor() {
    console.log('🧪 Testing VideoProcessor directly...');
    
    const processor = new VideoProcessor();
    
    // Mock job object like the one used by simple-queue
    const mockJob = {
        id: 'test_job_123',
        data: {
            jobId: 'test_job_123',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            options: {
                includeTranscript: true,
                includeAnalysis: true
            }
        },
        progress: (percent) => {
            console.log(`📊 Progress: ${percent}%`);
        },
        timestamp: Date.now()
    };

    try {
        console.log('🔄 Starting video processing...');
        const result = await processor.processVideo(mockJob);
        
        console.log('✅ Processing completed!');
        console.log('📋 Result:');
        console.log(JSON.stringify(result, null, 2));
        
    } catch (error) {
        console.error('❌ Processing failed:');
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testVideoProcessor().then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
});
