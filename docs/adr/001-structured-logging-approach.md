# ADR-001: Structured Logging Approach

**Status**: Proposed  
**Date**: 2025-12-11  
**Author**: GitHub Copilot Agent  
**Context**: Issue #40 discussion - Replace ad-hoc console.log usage with proper logging

## Context and Problem Statement

The findmydoc portal currently relies on unstructured `console.log`, `console.warn`, `console.error`, and `console.info` statements scattered across 30+ files. This approach has several limitations:

1. **Lack of Structure**: Console statements lack consistent formatting, context, and metadata
2. **Poor Production Observability**: No log aggregation, search, or filtering capabilities
3. **Mixed Concerns**: Authentication flows, user operations, errors, and debug info all use the same unstructured output
4. **Testing Friction**: Tests require custom silencing mechanisms (`TEST_SHOW_LOGS`, `silenceLogs.ts`)
5. **No Correlation**: Cannot correlate logs across request boundaries or user sessions
6. **Performance Impact**: Console operations in hot paths can degrade performance
7. **Security Risks**: Potential to accidentally log sensitive data (passwords, tokens)

### Current State Analysis

**Console Usage Distribution** (30+ occurrences):
- Authentication flows: `userCreation.ts`, `loginHandler.ts`, `registration.ts`, `supabaseProvision.ts`
- Access validation: `accessValidation.ts`, `jwtValidation.ts`, `firstAdminCheck.ts`
- Frontend components: `LoginForm.tsx`, `RegistrationForm.tsx`, `PatientRegistrationForm.tsx`
- API routes: `/api/auth/login`, `/api/auth/password/reset`, `/api/forms/[slug]`
- Media handling: `ImageMedia`, `VideoMedia`
- Form handling: `Form/Component.tsx`

**Existing Infrastructure**:
- **PayloadCMS**: Built-in Pino logger configured via `PAYLOAD_LOG_LEVEL` (currently defaults to 'error')
- **PostHog**: Already integrated for error tracking and analytics with user context
- **Next.js 15**: Instrumentation hooks (`instrumentation.ts`) for error tracking
- **Test Setup**: Custom log silencing via `TEST_SHOW_LOGS` environment variable

## Decision Drivers

1. **Leverage Existing Tools**: Maximize use of PayloadCMS's built-in Pino logger and PostHog
2. **Minimal Disruption**: Avoid introducing new heavy dependencies
3. **Type Safety**: Strong TypeScript support for log contexts and levels
4. **Production Ready**: Support for JSON structured logs, log levels, and metadata
5. **Developer Experience**: Easy to use, clear patterns, good local development experience
6. **Performance**: Low overhead, async logging, configurable buffering
7. **Testing**: Easy to mock, silence, or assert on logs in tests
8. **Security**: Prevent accidental logging of sensitive data

## Considered Options

### Option 1: Extend PayloadCMS Pino Logger (Recommended)

**Approach**: Create thin wrappers around Payload's existing Pino instance for application-wide logging.

**Pros**:
- ✅ Zero new dependencies (Pino already included with PayloadCMS)
- ✅ Already configured and tested in production environment
- ✅ Structured JSON logging out of the box
- ✅ Excellent performance (one of the fastest Node.js loggers)
- ✅ Supports child loggers with context inheritance
- ✅ Built-in serializers for errors, requests, responses
- ✅ Log level control via existing `PAYLOAD_LOG_LEVEL`
- ✅ TypeScript support included
- ✅ Can easily integrate with PostHog for error tracking

**Cons**:
- ⚠️ Payload logger instance only available in server contexts
- ⚠️ Need separate client-side logging strategy
- ⚠️ Requires wrapper utilities for consistent API

**Implementation Sketch**:
```typescript
// src/utilities/logger/server.ts
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

let cachedLogger: Awaited<ReturnType<typeof getPayload>>['logger'] | null = null

export async function getLogger() {
  if (!cachedLogger) {
    const payload = await getPayload({ config: configPromise })
    cachedLogger = payload.logger
  }
  return cachedLogger
}

// Usage
const logger = await getLogger()
logger.info({ userId, action: 'login' }, 'User logged in successfully')
logger.error({ error, email }, 'Failed to create Supabase user')
```

**Estimated Effort**: 2-3 days
- Create wrapper utilities (~4 hours)
- Replace console.log statements (~8 hours)
- Update tests and documentation (~4 hours)

---

### Option 2: Winston Logger

**Approach**: Adopt Winston as a comprehensive logging solution.

**Pros**:
- ✅ Very popular (22M+ downloads/week)
- ✅ Flexible transport system (file, console, HTTP, etc.)
- ✅ Multiple output formats (JSON, colorized, etc.)
- ✅ Good documentation and community support
- ✅ Works in both server and client contexts

**Cons**:
- ❌ New dependency to maintain (~1.2MB)
- ❌ Slower than Pino (2-3x in benchmarks)
- ❌ Duplicates existing PayloadCMS logger
- ❌ Additional configuration required
- ❌ Less TypeScript-friendly than alternatives

**Package**: `winston` (46.3 KB + transports)

**Implementation Sketch**:
```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
})
```

**Estimated Effort**: 3-4 days

---

### Option 3: Pino Standalone

**Approach**: Install Pino independently of PayloadCMS.

**Pros**:
- ✅ Fastest Node.js logger (benchmarks consistently top)
- ✅ Low overhead, async by default
- ✅ Excellent TypeScript support
- ✅ Child loggers for context
- ✅ Extensive ecosystem (transports, prettifiers)

**Cons**:
- ❌ Duplicates PayloadCMS's Pino instance
- ❌ Need to manage separate configuration
- ❌ Additional 80KB dependency (pino + pino-pretty)
- ❌ Complexity of maintaining two Pino instances

**Package**: `pino` + `pino-pretty`

**Estimated Effort**: 3-4 days

---

### Option 4: Console Wrapper + PostHog

**Approach**: Create structured wrapper around console.* methods, route errors to PostHog.

**Pros**:
- ✅ Zero new dependencies
- ✅ Works in browser and Node.js
- ✅ Leverages existing PostHog integration
- ✅ Minimal changes to existing code
- ✅ Easy to test and mock

**Cons**:
- ❌ Console is synchronous (performance impact)
- ❌ No structured logging in production (can't query JSON fields)
- ❌ Limited log level control
- ❌ No built-in serializers
- ❌ Still needs custom solution for sensitive data redaction

**Implementation Sketch**:
```typescript
// src/utilities/logger/console.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogContext = Record<string, unknown>

export const logger = {
  debug: (context: LogContext, message: string) => {
    if (shouldLog('debug')) {
      console.debug(JSON.stringify({ level: 'debug', ...context, message }))
    }
  },
  // ... other levels
}
```

**Estimated Effort**: 1-2 days

---

### Option 5: Debug Module + PostHog

**Approach**: Use the popular `debug` npm package for development, PostHog for production errors.

**Pros**:
- ✅ Very lightweight (11 KB)
- ✅ Popular (12M+ downloads/week)
- ✅ Namespace-based filtering (`DEBUG=auth:*`)
- ✅ Works in browser and Node.js
- ✅ Zero config for basic use

**Cons**:
- ❌ Primarily development tool, not production logger
- ❌ No structured logging
- ❌ No log levels (only on/off per namespace)
- ❌ Limited metadata support
- ❌ Would still need separate production solution

**Package**: `debug`

**Estimated Effort**: 2 days

---

## Comparison Matrix

| Criteria | Option 1: Payload Pino | Option 2: Winston | Option 3: Pino Standalone | Option 4: Console Wrapper | Option 5: Debug |
|----------|----------------------|-------------------|--------------------------|--------------------------|----------------|
| **New Dependencies** | 0 | 1 (winston) | 2 (pino, pino-pretty) | 0 | 1 (debug) |
| **Bundle Size** | 0 KB | ~1.2 MB | ~80 KB | 0 KB | ~11 KB |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Structured Logs** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **TypeScript** | ✅ Built-in | ⚠️ @types needed | ✅ Built-in | ✅ Custom | ⚠️ @types needed |
| **Server-side** | ✅ Excellent | ✅ Good | ✅ Excellent | ✅ Good | ✅ Good |
| **Client-side** | ❌ No | ⚠️ Complex | ⚠️ Complex | ✅ Yes | ✅ Yes |
| **PostHog Integration** | ✅ Easy | ✅ Easy | ✅ Easy | ✅ Native | ✅ Easy |
| **Test Mocking** | ✅ Easy | ⚠️ Medium | ⚠️ Medium | ✅ Easy | ✅ Easy |
| **Production Ready** | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited | ❌ No |
| **Learning Curve** | Low | Medium | Low | Low | Low |
| **Maintenance** | Low | Medium | Medium | Low | Low |
| **Implementation Time** | 2-3 days | 3-4 days | 3-4 days | 1-2 days | 2 days |

## Decision Outcome

**Chosen Option: Option 1 (Extend PayloadCMS Pino Logger) + Client-side Hybrid**

### Rationale

1. **Zero Dependencies**: Leverages existing PayloadCMS infrastructure
2. **Best Performance**: Pino is the fastest Node.js logger
3. **Production Battle-Tested**: Already proven in PayloadCMS deployments
4. **Structured by Default**: JSON logs with context out of the box
5. **Minimal Disruption**: Builds on existing configuration (`PAYLOAD_LOG_LEVEL`)
6. **Type Safe**: Strong TypeScript support included

### Hybrid Approach

**Server-side** (Next.js API routes, PayloadCMS hooks, server components):
- Use PayloadCMS Pino logger via wrapper utilities
- Structured JSON logging with metadata
- Child loggers for request/user context

**Client-side** (Browser, React components):
- Lightweight console wrapper for development
- PostHog for production error tracking
- Selective logging based on `NODE_ENV`

### Architecture

```
src/utilities/logger/
├── index.ts              # Main exports, environment detection
├── server.ts             # Pino wrapper for server-side
├── client.ts             # Browser-safe console wrapper
├── context.ts            # Type definitions for log contexts
└── redact.ts             # Sensitive data redaction utilities
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. **Create Logger Utilities** (~1 day)
   - Server-side Pino wrapper with caching
   - Client-side console wrapper
   - TypeScript types and context definitions
   - Sensitive data redaction helpers

2. **Update Configuration** (~0.5 day)
   - Document `PAYLOAD_LOG_LEVEL` options
   - Add `LOG_REDACT_KEYS` environment variable
   - Update `.env.example` with logging config

3. **Testing Support** (~0.5 day)
   - Create logger mocks for unit tests
   - Update `silenceLogs.ts` to handle new logger
   - Add logger test helpers

### Phase 2: Migration (Week 2)
4. **Migrate Critical Paths** (~2 days)
   - Authentication flows (highest priority)
   - API routes
   - Server-side error handling
   - PayloadCMS hooks

5. **Migrate Frontend** (~1 day)
   - React components
   - Client-side error boundaries
   - PostHog integration updates

6. **Documentation** (~1 day)
   - Create `docs/logging.md`
   - Update contributing guidelines
   - Add logging examples and patterns

### Phase 3: Refinement (Week 3)
7. **Code Review & Cleanup**
   - Remove all `console.*` statements
   - Add ESLint rule to prevent `console.*`
   - Performance testing

8. **Monitoring Setup**
   - Configure log aggregation (if using external service)
   - Set up alerts for error rates
   - Document production log access

## Logging Patterns & Best Practices

### Server-side Examples

```typescript
// Authentication success
import { getLogger } from '@/utilities/logger'

const logger = await getLogger()
logger.info(
  { 
    userId: user.id, 
    userType: user.userType,
    email: user.email,
    action: 'login'
  }, 
  'User logged in successfully'
)

// Error with context
logger.error(
  { 
    error: error.message,
    stack: error.stack,
    email: email,
    operation: 'supabase_create_user'
  }, 
  'Failed to create Supabase user'
)

// Child logger for request context
const requestLogger = logger.child({ requestId: req.id, path: req.url })
requestLogger.info('Processing request')
```

### Client-side Examples

```typescript
import { logger } from '@/utilities/logger'

// Development logging
logger.debug({ component: 'LoginForm', action: 'submit' }, 'Form submitted')

// Production error tracking (routes to PostHog)
logger.error({ 
  error: error.message, 
  component: 'LoginForm',
  userId: user?.id 
}, 'Login failed')
```

### Sensitive Data Redaction

```typescript
import { redactSensitive } from '@/utilities/logger/redact'

const safeContext = redactSensitive({
  email: 'user@example.com',
  password: 'secret123',  // Will be redacted
  token: 'jwt-token',      // Will be redacted
  userId: 123
})

logger.info(safeContext, 'User operation')
// Logs: { email: 'user@example.com', password: '[REDACTED]', token: '[REDACTED]', userId: 123 }
```

## Configuration

### Environment Variables

```bash
# Payload/Pino log level (server-side)
# Values: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
PAYLOAD_LOG_LEVEL=info  # Production: 'error' | Development: 'info' or 'debug'

# Client-side log level
NEXT_PUBLIC_LOG_LEVEL=warn  # Production: 'warn' | Development: 'debug'

# Keys to redact from logs (comma-separated)
LOG_REDACT_KEYS=password,token,secret,apiKey,supabaseKey

# Test logging control (already exists)
TEST_SHOW_LOGS=1  # Show logs during test runs
```

## Monitoring & Observability

### Development
- Pretty-printed logs to console via Pino Pretty
- Debug-level logging enabled
- Source maps for stack traces

### Production
- JSON structured logs for parsing
- Error-level logging by default
- Log aggregation via Vercel logs or external service
- PostHog for frontend error tracking
- Alerts on error rate thresholds

### Log Aggregation Options (Future)
- **Vercel Logs**: Built-in, query via dashboard
- **Datadog**: Full APM + log aggregation
- **Logtail**: Lightweight, good for Next.js
- **CloudWatch**: If deploying to AWS
- **Self-hosted**: Loki + Grafana

## Security Considerations

1. **Sensitive Data Redaction**
   - Automatic redaction of password, token, secret fields
   - Configurable via `LOG_REDACT_KEYS`
   - Email addresses logged only at info+ levels

2. **Log Access Control**
   - Production logs accessible only to authorized team members
   - Log retention policies (30-90 days typical)
   - PII handling per GDPR/privacy requirements

3. **Performance**
   - Async logging to prevent blocking operations
   - Log level filtering to reduce volume
   - Buffering and batching for efficiency

## Testing Strategy

### Unit Tests
```typescript
import { vi } from 'vitest'
import { getLogger } from '@/utilities/logger'

test('logs user creation', async () => {
  const logger = await getLogger()
  const infoSpy = vi.spyOn(logger, 'info')
  
  await createUser(payload, authData, config, req)
  
  expect(infoSpy).toHaveBeenCalledWith(
    expect.objectContaining({ userId: expect.any(Number) }),
    expect.stringContaining('Created')
  )
})
```

### Integration Tests
- Verify log output format in different environments
- Test redaction of sensitive fields
- Validate PostHog integration

## Migration Checklist

- [ ] Create logger utility modules
- [ ] Add TypeScript types and interfaces
- [ ] Implement sensitive data redaction
- [ ] Update test setup and mocks
- [ ] Migrate authentication flows
- [ ] Migrate API routes
- [ ] Migrate frontend components
- [ ] Add ESLint rule: `no-console`
- [ ] Update documentation
- [ ] Configure production log aggregation
- [ ] Set up error alerts
- [ ] Remove `console.*` statements (except console.error in critical failures)

## Future Enhancements

1. **Distributed Tracing**: Add OpenTelemetry for request tracing
2. **Log Aggregation**: Centralized log service (Datadog, Logtail, CloudWatch)
3. **Real-time Alerts**: Error rate thresholds, anomaly detection
4. **Performance Monitoring**: Log query performance, slow operations
5. **Audit Logging**: Separate audit trail for compliance (user actions, data changes)

## References

- [Pino Documentation](https://getpino.io/)
- [PayloadCMS Logger](https://payloadcms.com/docs/configuration/overview#logger)
- [Next.js 15 Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [PostHog Error Tracking](https://posthog.com/docs/product-analytics/capture-errors)
- [Log4j Best Practices](https://logging.apache.org/log4j/2.x/manual/best-practices.html)
- [Twelve-Factor App: Logs](https://12factor.net/logs)

## Success Metrics

- ✅ Zero `console.log` statements outside of development utilities
- ✅ All authentication flows using structured logging
- ✅ Error logs include full context (user, operation, error details)
- ✅ Production logs queryable by field (userId, action, error type)
- ✅ Test suite runs without log noise (unless `TEST_SHOW_LOGS=1`)
- ✅ No accidental logging of passwords or tokens
- ✅ Error rates tracked and alerted via PostHog

---

**Next Steps**: Discuss this ADR with the team, gather feedback, and proceed with Phase 1 implementation if approved.
