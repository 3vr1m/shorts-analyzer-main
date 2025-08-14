import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';
import { monitoring } from '@/lib/monitoring';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const adminSecret = url.searchParams.get('admin_secret');
    const adminKey = request.headers.get('x-admin-key');
    
    // Check if environment variables are set
    const hasAdminKey = !!process.env.ADMIN_API_KEY;
    const hasAdminSecret = !!process.env.ADMIN_SECRET;
    
    // Simple authentication: check if admin key/secret matches
    const isAuthenticated = 
      (hasAdminKey && adminKey === process.env.ADMIN_API_KEY) ||
      (hasAdminSecret && adminSecret === process.env.ADMIN_SECRET) ||
      (!hasAdminKey && !hasAdminSecret); // Allow access if no auth is configured

    if (!isAuthenticated) {
      return NextResponse.json(
        { 
          error: 'Access denied. Admin privileges required.',
          code: 'ADMIN_ACCESS_REQUIRED',
          hint: hasAdminSecret ? 'Try adding ?admin_secret=YOUR_SECRET to the URL' : 'Set x-admin-key header'
        },
        { status: 403 }
      );
    }

    // Get system metrics
    const metrics = monitoring.exportLogs();
    
    // Add some runtime stats
    const runtimeStats = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...metrics,
      runtime: runtimeStats
    });

  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check admin access
    if (!isAdminRequest(request)) {
      return NextResponse.json(
        { 
          error: 'Access denied. Admin privileges required.',
          code: 'ADMIN_ACCESS_REQUIRED'
        },
        { status: 403 }
      );
    }

    // Clear logs functionality
    monitoring.clearOldLogs(0); // Clear all logs
    console.log('Admin requested log clearing at:', new Date().toISOString());
    
    return NextResponse.json({
      success: true,
      message: 'Logs cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Log clearing error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    },
  });
}
