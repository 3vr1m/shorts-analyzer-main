/**
 * Monitoring and Error Handling System
 * Provides comprehensive logging, error tracking, and performance monitoring
 */

export interface ErrorContext {
  endpoint: string;
  method: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  error: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: string;
  success: boolean;
  cacheHit?: boolean;
  platform?: string;
}

export interface APIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  rateLimitHits: number;
  lastUpdated: string;
}

class MonitoringSystem {
  private errors: ErrorContext[] = [];
  private performance: PerformanceMetrics[] = [];
  private apiMetrics: APIMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    rateLimitHits: 0,
    lastUpdated: new Date().toISOString()
  };

  private maxLogSize = 1000; // Keep last 1000 entries

  /**
   * Log an error with context
   */
  logError(context: Omit<ErrorContext, 'timestamp'>): void {
    const errorContext: ErrorContext = {
      ...context,
      timestamp: new Date().toISOString()
    };

    this.errors.unshift(errorContext);
    
    // Keep only the last maxLogSize errors
    if (this.errors.length > this.maxLogSize) {
      this.errors = this.errors.slice(0, this.maxLogSize);
    }

    // Update API metrics
    this.apiMetrics.failedRequests++;
    this.updateMetrics();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ERROR]', errorContext);
    }

    // In production, you might want to send to external services
    // like Sentry, LogRocket, or your own logging service
    this.sendToExternalService(errorContext);
  }

  /**
   * Log performance metrics
   */
  logPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
    const performanceMetrics: PerformanceMetrics = {
      ...metrics,
      timestamp: new Date().toISOString()
    };

    this.performance.unshift(performanceMetrics);
    
    // Keep only the last maxLogSize entries
    if (this.performance.length > this.maxLogSize) {
      this.performance = this.performance.slice(0, this.maxLogSize);
    }

    // Update API metrics
    this.apiMetrics.totalRequests++;
    if (metrics.success) {
      this.apiMetrics.successfulRequests++;
    }
    
    // Update average response time
    const totalTime = this.performance.reduce((sum, p) => sum + p.duration, 0);
    this.apiMetrics.averageResponseTime = totalTime / this.performance.length;
    
    this.updateMetrics();
  }

  /**
   * Log cache hit/miss
   */
  logCacheHit(endpoint: string, method: string, hit: boolean): void {
    // Update cache hit rate
    const cacheMetrics = this.performance.filter(p => 
      p.endpoint === endpoint && p.method === method
    );
    
    if (cacheMetrics.length > 0) {
      const hits = cacheMetrics.filter(p => p.cacheHit).length;
      this.apiMetrics.cacheHitRate = hits / cacheMetrics.length;
    }
  }

  /**
   * Log rate limit hit
   */
  logRateLimitHit(): void {
    this.apiMetrics.rateLimitHits++;
    this.updateMetrics();
  }

  /**
   * Get error summary
   */
  getErrorSummary(): {
    total: number;
    recent: number;
    byEndpoint: Record<string, number>;
    byType: Record<string, number>;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentErrors = this.errors.filter(e => 
      new Date(e.timestamp) > oneHourAgo
    );

    const byEndpoint: Record<string, number> = {};
    const byType: Record<string, number> = {};

    this.errors.forEach(error => {
      byEndpoint[error.endpoint] = (byEndpoint[error.endpoint] || 0) + 1;
      
      // Categorize errors by type
      let errorType = 'unknown';
      if (error.error.includes('rate limit')) errorType = 'rate_limit';
      else if (error.error.includes('validation')) errorType = 'validation';
      else if (error.error.includes('api')) errorType = 'api_error';
      else if (error.error.includes('network')) errorType = 'network';
      else if (error.error.includes('timeout')) errorType = 'timeout';
      
      byType[errorType] = (byType[errorType] || 0) + 1;
    });

    return {
      total: this.errors.length,
      recent: recentErrors.length,
      byEndpoint,
      byType
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    total: number;
    averageResponseTime: number;
    byEndpoint: Record<string, { count: number; avgTime: number; successRate: number }>;
    cacheHitRate: number;
  } {
    const byEndpoint: Record<string, { count: number; avgTime: number; successRate: number }> = {};

    this.performance.forEach(metric => {
      if (!byEndpoint[metric.endpoint]) {
        byEndpoint[metric.endpoint] = { count: 0, avgTime: 0, successRate: 0 };
      }

      const endpoint = byEndpoint[metric.endpoint];
      endpoint.count++;
      endpoint.avgTime = (endpoint.avgTime * (endpoint.count - 1) + metric.duration) / endpoint.count;
      
      const successful = this.performance.filter(p => 
        p.endpoint === metric.endpoint && p.success
      ).length;
      endpoint.successRate = successful / endpoint.count;
    });

    return {
      total: this.performance.length,
      averageResponseTime: this.apiMetrics.averageResponseTime,
      byEndpoint,
      cacheHitRate: this.apiMetrics.cacheHitRate
    };
  }

  /**
   * Get API metrics
   */
  getAPIMetrics(): APIMetrics {
    return { ...this.apiMetrics };
  }

  /**
   * Clear old logs
   */
  clearOldLogs(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    this.errors = this.errors.filter(e => new Date(e.timestamp) > cutoff);
    this.performance = this.performance.filter(p => new Date(p.timestamp) > cutoff);
    
    this.updateMetrics();
  }

  /**
   * Export logs for analysis
   */
  exportLogs(): {
    errors: ErrorContext[];
    performance: PerformanceMetrics[];
    apiMetrics: APIMetrics;
    summary: {
      errors: ReturnType<typeof MonitoringSystem.prototype.getErrorSummary>;
      performance: ReturnType<typeof MonitoringSystem.prototype.getPerformanceSummary>;
    };
  } {
    return {
      errors: [...this.errors],
      performance: [...this.performance],
      apiMetrics: this.getAPIMetrics(),
      summary: {
        errors: this.getErrorSummary(),
        performance: this.getPerformanceSummary()
      }
    };
  }

  private updateMetrics(): void {
    this.apiMetrics.lastUpdated = new Date().toISOString();
  }

  private sendToExternalService(error: ErrorContext): void {
    // In production, implement external logging service integration
    // Examples: Sentry, LogRocket, DataDog, etc.
    
    if (process.env.SENTRY_DSN) {
      // Sentry integration
      try {
        // Sentry.captureException(new Error(error.error), {
        //   extra: error.metadata,
        //   tags: {
        //     endpoint: error.endpoint,
        //     method: error.method
        //   }
        // });
      } catch (e) {
        console.warn('Failed to send to Sentry:', e);
      }
    }

    if (process.env.LOG_ENDPOINT) {
      // Custom logging endpoint
      try {
        fetch(process.env.LOG_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(error)
        }).catch(() => {
          // Silently fail if external logging fails
        });
      } catch (e) {
        // Silently fail
      }
    }
  }
}

// Singleton instance
export const monitoring = new MonitoringSystem();

// Utility functions for easy usage
export function logError(context: Omit<ErrorContext, 'timestamp'>): void {
  monitoring.logError(context);
}

export function logPerformance(metrics: Omit<PerformanceMetrics, 'timestamp'>): void {
  monitoring.logPerformance(metrics);
}

export function logCacheHit(endpoint: string, method: string, hit: boolean): void {
  monitoring.logCacheHit(endpoint, method, hit);
}

export function logRateLimitHit(): void {
  monitoring.logRateLimitHit();
}

// Performance measurement decorator
export function measurePerformance(endpoint: string, method: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      let success = false;
      let cacheHit = false;

      try {
        const result = await method.apply(this, args);
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const duration = Date.now() - start;
        logPerformance({
          endpoint,
          method,
          duration,
          success,
          cacheHit
        });
      }
    };
  };
}
