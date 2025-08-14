/**
 * Security Module for Shorts Analyzer
 * Provides rate limiting, input validation, and security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS: 10, // Max requests per window
  BURST_LIMIT: 20, // Burst limit for short periods
};

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Input validation schemas
export const URL_SCHEMA = z.object({
  url: z.string()
    .url('Invalid URL format')
    .refine((url) => {
      const allowedDomains = [
        'youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com'
      ];
      try {
        const domain = new URL(url).hostname.toLowerCase();
        return allowedDomains.some(allowed => domain.includes(allowed));
      } catch {
        return false;
      }
    }, 'URL must be from YouTube, Instagram, or TikTok')
    .refine((url) => url.length < 500, 'URL too long')
});

export const SCRIPT_REQUEST_SCHEMA = z.object({
  niche: z.string()
    .min(1, 'Niche is required')
    .max(100, 'Niche too long')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid niche format'),
  topic: z.string()
    .min(1, 'Topic is required')
    .max(200, 'Topic too long')
    .regex(/^[a-zA-Z0-9\s\-_.,!?]+$/, 'Invalid topic format')
});

export const TRENDING_REQUEST_SCHEMA = z.object({
  platform: z.enum(['youtube', 'instagram', 'tiktok']).optional(),
  country: z.string().length(2).optional(),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  limit: z.number().min(1).max(50).optional()
});

// Rate limiting middleware
export function rateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS
    });
    return { allowed: true, remaining: RATE_LIMIT_CONFIG.MAX_REQUESTS - 1, resetTime: now + RATE_LIMIT_CONFIG.WINDOW_MS };
  }

  if (record.count >= RATE_LIMIT_CONFIG.MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(key, record);
  
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_CONFIG.MAX_REQUESTS - record.count, 
    resetTime: record.resetTime 
  };
}

// Get client identifier for rate limiting
export function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  let clientIP = 'unknown';
  
  if (forwarded) {
    clientIP = forwarded.split(',')[0].trim();
  } else if (realIP) {
    clientIP = realIP;
  } else if (cfConnectingIP) {
    clientIP = cfConnectingIP;
  }

  // Fallback to user agent if IP is not available
  if (clientIP === 'unknown' || clientIP === '::1') {
    const userAgent = req.headers.get('user-agent') || 'unknown';
    return `ua:${userAgent.substring(0, 50)}`;
  }

  return `ip:${clientIP}`;
}

// Security headers middleware
export function addSecurityHeaders(response: Response | NextResponse): Response | NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  return response;
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .substring(0, 1000); // Limit length
}

// URL validation and sanitization
export function validateAndSanitizeURL(url: string): { valid: boolean; sanitized?: string; error?: string } {
  try {
    // Basic URL validation
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Invalid protocol' };
    }
    
    // Check domain
    const hostname = urlObj.hostname.toLowerCase();
    const allowedDomains = ['youtube.com', 'youtu.be', 'instagram.com', 'tiktok.com'];
    
    if (!allowedDomains.some(domain => hostname.includes(domain))) {
      return { valid: false, error: 'Domain not allowed' };
    }
    
    // Sanitize and return
    const sanitized = urlObj.toString();
    return { valid: true, sanitized };
    
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// API key validation
export function validateAPIKey(apiKey: string, service: 'openai' | 'gemini' | 'rapidapi'): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  switch (service) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'gemini':
      return apiKey.length > 20 && /^[A-Za-z0-9_-]+$/.test(apiKey);
    case 'rapidapi':
      return apiKey.length > 20 && apiKey !== 'demo-key' && apiKey !== 'your-rapidapi-key';
    default:
      return false;
  }
}

// Request validation wrapper
export async function validateRequest<T>(
  req: NextRequest, 
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return { success: false, error: firstError.message };
    }
    return { success: false, error: 'Invalid request data' };
  }
}

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_CONFIG.WINDOW_MS);

// Export rate limit info for monitoring
export function getRateLimitStats() {
  return {
    activeConnections: rateLimitStore.size,
    windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.MAX_REQUESTS,
    burstLimit: RATE_LIMIT_CONFIG.BURST_LIMIT
  };
}
