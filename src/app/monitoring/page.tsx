"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MonitoringData {
  timestamp: string;
  summary: {
    errors: {
      total: number;
      recent: number;
      byEndpoint: Record<string, number>;
      byType: Record<string, number>;
    };
    performance: {
      total: number;
      averageResponseTime: number;
      byEndpoint: Record<string, { count: number; avgTime: number; successRate: number }>;
      cacheHitRate: number;
    };
    api: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      averageResponseTime: number;
      cacheHitRate: number;
      rateLimitHits: number;
      lastUpdated: string;
    };
    rateLimit: {
      activeConnections: number;
      windowMs: number;
      maxRequests: number;
      burstLimit: number;
    };
  };
  recentLogs: {
    errors: Array<{
      endpoint: string;
      method: string;
      error: string;
      timestamp: string;
      ip?: string;
    }>;
    performance: Array<{
      endpoint: string;
      method: string;
      duration: number;
      success: boolean;
      cacheHit?: boolean;
      platform?: string;
      timestamp: string;
    }>;
  };
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    nodeVersion: string;
    platform: string;
  };
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminKey, setAdminKey] = useState<string>('');

  // Check admin access on component mount
  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const response = await fetch('/api/monitoring');
      if (response.status === 403) {
        setIsAdmin(false);
      } else if (response.status === 200) {
        setIsAdmin(true);
        fetchData();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      setIsAdmin(false);
    }
  };

  const authenticateAdmin = async () => {
    if (!adminKey.trim()) return;
    
    try {
      const response = await fetch('/api/monitoring', {
        headers: {
          'x-admin-key': adminKey
        }
      });
      
      if (response.status === 200) {
        setIsAdmin(true);
        setAdminKey('');
        fetchData();
      } else {
        alert('Invalid admin key');
      }
    } catch (error) {
      alert('Authentication failed');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/monitoring');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      const monitoringData = await response.json();
      console.log('Monitoring data received:', monitoringData);
      setData(monitoringData);
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      const response = await fetch('/api/monitoring', { method: 'DELETE' });
      if (response.ok) {
        fetchData(); // Refresh data after clearing
      } else {
        throw new Error('Failed to clear logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear logs');
    }
  };

  // Show admin authentication form if not authenticated
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Admin Access Required</h1>
            <p className="text-gray-600 mb-6">This page requires administrative privileges.</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-2">
                Admin API Key
              </label>
              <input
                id="adminKey"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="Enter admin key"
              />
            </div>
            
            <button
              onClick={authenticateAdmin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Authenticate
            </button>
          </div>
          
          <div className="text-center text-sm text-gray-500">
            <p>Or access with admin_secret query parameter in development</p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while checking admin status
  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Error Loading Monitoring Data</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No monitoring data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
          <button
            onClick={clearLogs}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Clear Old Logs
          </button>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{data.summary.api.totalRequests}</div>
              <p className="text-xs text-gray-500">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {data.summary.api.totalRequests > 0 
                  ? Math.round((data.summary.api.successfulRequests / data.summary.api.totalRequests) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-gray-500">
                {data.summary.api.successfulRequests} / {data.summary.api.totalRequests}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(data.summary.api.averageResponseTime)}ms
              </div>
              <p className="text-xs text-gray-500">Last {data.summary.performance.total} requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Cache Hit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(data.summary.api.cacheHitRate * 100)}%
              </div>
              <p className="text-xs text-gray-500">Performance optimization</p>
            </CardContent>
          </Card>
        </div>

        {/* Error Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-red-600">⚠️</span>
              Error Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Total Errors</p>
                <p className="text-2xl font-bold text-red-600">{data.summary.errors.total}</p>
              </div>
              <div>
                <p className="text-gray-600">Recent (1h)</p>
                <p className="text-2xl font-bold text-orange-600">{data.summary.errors.recent}</p>
              </div>
              <div>
                <p className="text-gray-600">Rate Limit Hits</p>
                <p className="text-2xl font-bold text-yellow-600">{data.summary.api.rateLimitHits}</p>
              </div>
            </div>
            
            {Object.keys(data.summary.errors.byType).length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold text-gray-700 mb-2">Errors by Type</h5>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.summary.errors.byType).map(([type, count]) => (
                    <span key={type} className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance by Endpoint */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              Performance by Endpoint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.summary.performance.byEndpoint).map(([endpoint, stats]) => (
                <div key={endpoint} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <h5 className="font-medium text-gray-700">{endpoint}</h5>
                    <p className="text-sm text-gray-500">
                      {stats.count} requests • {Math.round(stats.avgTime)}ms avg
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      {Math.round(stats.successRate * 100)}%
                    </div>
                    <p className="text-xs text-gray-500">success rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Uptime:</strong> {Math.floor(data.system.uptime / 3600)}h {Math.floor((data.system.uptime % 3600) / 60)}m</p>
            <p><strong>Node Version:</strong> {data.system.nodeVersion}</p>
            <p><strong>Platform:</strong> {data.system.platform}</p>
            <p><strong>Memory Usage:</strong> {Math.round(data.system.memory.heapUsed / 1024 / 1024)}MB / {Math.round(data.system.memory.heapTotal / 1024 / 1024)}MB</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Errors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentLogs.errors.length === 0 ? (
                  <p className="text-gray-500 text-sm">No recent errors</p>
                ) : (
                  data.recentLogs.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-red-800">{error.error}</p>
                          <p className="text-sm text-red-600">{error.endpoint} {error.method}</p>
                        </div>
                        <span className="text-xs text-red-500">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentLogs.performance.length === 0 ? (
                  <p className="text-gray-500 text-sm">No recent performance data</p>
                ) : (
                  data.recentLogs.performance.map((perf, index) => (
                    <div key={index} className={`p-3 rounded-lg border-l-4 ${
                      perf.success ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className={`font-medium ${perf.success ? 'text-green-800' : 'text-red-800'}`}>
                            {perf.endpoint} {perf.method}
                          </p>
                          <p className={`text-sm ${perf.success ? 'text-green-600' : 'text-red-600'}`}>
                            {perf.duration}ms {perf.cacheHit ? '(cached)' : ''}
                          </p>
                        </div>
                        <span className={`text-xs ${perf.success ? 'text-green-500' : 'text-red-500'}`}>
                          {new Date(perf.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-gray-500">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
