/**
 * Simple Admin Authentication for Development/Internal Use
 * In production, this should be replaced with proper authentication
 */

export function isAdminRequest(req: Request): boolean {
  // Check for admin API key in headers
  const adminKey = req.headers.get('x-admin-key');
  if (adminKey === process.env.ADMIN_API_KEY) {
    return true;
  }

  // Check for admin secret in query params (for development)
  const url = new URL(req.url);
  const adminSecret = url.searchParams.get('admin_secret');
  if (adminSecret === process.env.ADMIN_SECRET) {
    return true;
  }

  // Check if running in development mode
  if (process.env.NODE_ENV === 'development') {
    // In development, allow access from localhost
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    if (clientIP === '127.0.0.1' || clientIP === 'localhost' || clientIP.includes('::1')) {
      return true;
    }
  }

  return false;
}

export function requireAdmin(req: Request): Response | null {
  if (!isAdminRequest(req)) {
    return new Response(
      JSON.stringify({ 
        error: 'Access denied. Admin privileges required.',
        code: 'ADMIN_ACCESS_REQUIRED'
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  return null;
}
