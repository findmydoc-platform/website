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
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_FEATURE_FLAGS_SECURE_API_KEY=phx_xxx
```

> **Note:** The project targets the EU host (`https://eu.i.posthog.com`); keep that consistent in documentation and deployments.
> **Security:** `POSTHOG_FEATURE_FLAGS_SECURE_API_KEY` is a server-side secret for local feature flag evaluation. Store it in Vercel environment variables or a secrets manager, not in PayloadCMS.

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
├── server.ts         # Server PostHog client (Node.js 26.x runtime)  
├── flag-definition-cache.ts # Vercel Runtime Cache adapter for local flag definitions
├── identify.ts       # Smart user identification
└── client-only.ts    # Safe client imports
```

### Feature Flags
- **Evaluation**: Feature flags are evaluated server-side through the PostHog Node SDK with local evaluation enabled.
- **Guard flags**: `temporary-landing-mode` controls the production holding page and `preview-guard-enabled` controls preview access protection.
- **URL targeting**: Guard flag checks use a server-side site actor and pass `feature_flag_site_host` plus normalized `feature_flag_site_path` as person properties so PostHog can target domains and paths differently without query parameters.
- **Rule shape**: Guard flags should use host/path conditions, not per-person rollout rules. The site actor prevents client-controlled PostHog cookies from influencing access decisions.
- **Defaults**: Registered guard flags default to `false` in code when PostHog is unavailable or the secure key is missing.
- **Control source**: PostHog is the only activation source for these guard flags. The code does not special-case preview, production, local runtime, or known hosts.
- **Browser behavior**: `advanced_disable_feature_flags: true` prevents `posthog-js` from fetching flags in the browser. The browser client remains responsible for analytics, replay, and error tracking.
- **Cached data**: Only PostHog flag definitions are cached. User-specific flag results are not persisted.
- **Vercel behavior**: On Vercel, flag definitions use Runtime Cache with a 120 second TTL. Outside Vercel, the SDK falls back to its in-memory cache.
- **Cost note**: Runtime Cache is available on all Vercel plans, including Hobby/free accounts, but Vercel treats reads and writes as billable usage. Check current Vercel pricing before relying on it as permanently zero-cost infrastructure.

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
pnpm tests tests/unit/posthog/

# Verify build integration  
pnpm check
```

### PostHog Dashboard
- **Session Replay**: View user interactions and debug issues
- **Error Tracking**: Monitor and resolve application errors
- **Analytics**: Track user behavior and application usage

---

**Status**: Production ready with performance optimization and comprehensive testing.
