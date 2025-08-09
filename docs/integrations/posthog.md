# PostHog Analytics Integration

Session replay, error tracking, and web analytics integrated with Supabase authentication.

## Features

- **Session Replay**: Records user interactions for debugging and support
- **Error Tracking**: Captures frontend/backend errors with user context  
- **Web Analytics**: Pageviews, navigation, and user behavior tracking

## Setup

### Environment Variables
```bash
# Required
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phx_xxx
```

### Verification
1. **Browser Console**: Check for PostHog initialization messages
2. **Network Tab**: Verify requests to PostHog endpoints
3. **PostHog Dashboard**: View real-time events and sessions

## Architecture

### File Organization
```
src/posthog/
├── index.ts          # Main exports
├── client.ts         # Browser PostHog client
├── server.ts         # Node.js PostHog client  
├── identify.ts       # Smart user identification
└── client-only.ts    # Safe client imports
```

### User Identification
- **Anonymous Users**: Automatic tracking with session IDs
- **Authenticated Users**: Auto-identified on login via Supabase strategy
- **Logout**: PostHog context reset to prevent session mixing
- **Performance**: Smart caching prevents redundant API calls

### Integration Points
- `src/auth/strategies/supabaseStrategy.ts` - User identification on auth
- `src/instrumentation.ts` - Server-side error tracking
- `src/instrumentation-client.ts` - Client-side initialization

## Privacy & Security

### Data Collected
- User profile: email, user type, name (from Supabase)
- Interaction data: clicks, pageviews, navigation
- Error context: request details, stack traces
- Session recordings: user interactions (authenticated users only)

### Not Collected
- Payment information
- Medical data
- Authentication tokens
- Personal identifiers beyond Supabase user ID

## Troubleshooting

### Common Issues
- **No events appearing**: Check environment variables and network requests
- **User not identified**: Verify Supabase authentication flow
- **Performance impact**: Smart caching reduces API calls automatically

### Debug Commands
```bash
# Check integration in tests
pnpm test tests/unit/posthog/

# Verify build integration  
pnpm check
```

### PostHog Dashboard
- **Session Replay**: View user interactions and debug issues
- **Error Tracking**: Monitor and resolve application errors
- **Analytics**: Track user behavior and application usage

---

**Status**: Production ready with performance optimization and comprehensive testing.
