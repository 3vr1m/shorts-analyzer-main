# Security Setup for Shorts Analyzer

## Admin Access Control

The monitoring and test-security pages are now protected with admin authentication to prevent unauthorized access to sensitive system information.

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Admin Authentication (Required for monitoring and security pages)
ADMIN_API_KEY=your-secret-admin-key-here
ADMIN_SECRET=your-development-admin-secret-here
```

## Access Methods

### 1. API Key Authentication (Recommended)
Set the `ADMIN_API_KEY` environment variable and use it in the `x-admin-key` header:

```bash
curl -H "x-admin-key: your-secret-admin-key-here" http://localhost:3000/api/monitoring
```

### 2. Query Parameter (Development Only)
In development mode, you can also access with the `admin_secret` query parameter:

```
http://localhost:3000/monitoring?admin_secret=your-development-admin-secret-here
```

### 3. Localhost Access (Development Only)
In development mode, access from localhost (127.0.0.1) is automatically granted.

## Security Features

- **Rate Limiting**: API endpoints are protected against abuse
- **Input Validation**: All user inputs are sanitized and validated
- **Security Headers**: CSP, XSS protection, frame options, etc.
- **Error Logging**: Comprehensive error tracking and monitoring
- **Access Control**: Admin-only access to sensitive endpoints

## Production Considerations

In production, consider implementing:
- Proper user authentication system
- Role-based access control
- HTTPS enforcement
- IP whitelisting
- Audit logging
- Session management

## Testing Security

Use the `/test-security` page to verify:
- Security headers are properly set
- Monitoring system is working
- Rate limiting is functional
- Input validation is working

## Troubleshooting

If you get "Access denied" errors:
1. Check that environment variables are set correctly
2. Verify the admin key is being sent in the correct header
3. Ensure you're not being rate limited
4. Check the browser console for any JavaScript errors
