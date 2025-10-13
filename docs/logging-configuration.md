# Logging Configuration

This document describes the logging configuration for the findmydoc-portal application, particularly for testing environments.

## Overview

The application uses PayloadCMS's built-in logger (based on Pino) with configurable log levels and conditional logging for hooks.

## Environment Variables

### `PAYLOAD_LOG_LEVEL`

Controls the overall log level for the Payload logger.

**Valid values:**
- `silent` - No logs
- `error` - Only error messages
- `warn` - Warnings and errors
- `info` - Informational messages, warnings, and errors
- `debug` - Verbose debugging output (default in development)

**Example:**
```bash
PAYLOAD_LOG_LEVEL=error
```

**Configuration location:** `src/payload.config.ts`

```typescript
logger: {
  options: {
    level: process.env.PAYLOAD_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    name: 'findmydoc',
  },
}
```

### `SUPPRESS_HOOK_LOGS`

Controls whether informational logs from hooks are displayed. This is particularly useful during testing to reduce noise.

**Valid values:**
- `true` - Suppress hook info logs
- `false` - Show hook info logs (default)

**Example:**
```bash
SUPPRESS_HOOK_LOGS=true
```

**Affected hooks:**
- `updateAveragePriceAfterChange` - Clinic treatment average price calculation
- `updateAveragePriceAfterDelete` - Clinic treatment average price recalculation
- `updateAverageRatingsAfterChange` - Review average rating calculation
- `updateAverageRatingsAfterDelete` - Review average rating recalculation

**Note:** Error logs from these hooks are **always** shown, regardless of this setting.

## Testing Configuration

### Unit Tests

Unit tests automatically load `.env.test` through the Payload config when `NODE_ENV=test`.

**Recommended settings:**
```bash
PAYLOAD_LOG_LEVEL=error
SUPPRESS_HOOK_LOGS=true
```

This configuration:
- Shows only errors during test execution
- Hides routine hook info messages like "Updating average price after..."
- Makes test output cleaner and easier to read

### Integration Tests

Integration tests use the same `.env.test` configuration.

**For debugging failed tests:**
```bash
# Temporarily change in .env.test
PAYLOAD_LOG_LEVEL=debug
SUPPRESS_HOOK_LOGS=false
```

Then run the specific failing test to see detailed logging.

## Production Configuration

In production, the default log level is `info` unless overridden by `PAYLOAD_LOG_LEVEL`.

**Recommended production settings:**
```bash
# Optional: set explicitly if you want to override the default
PAYLOAD_LOG_LEVEL=info
```

Hook logs are shown by default in production (helpful for monitoring average price/rating calculations).

## Examples

### Example 1: Silent Testing

Completely suppress all logs during test runs:

```bash
# .env.test
PAYLOAD_LOG_LEVEL=silent
SUPPRESS_HOOK_LOGS=true
```

### Example 2: Debug Mode

See all logging during development:

```bash
# .env.local
PAYLOAD_LOG_LEVEL=debug
SUPPRESS_HOOK_LOGS=false
```

### Example 3: Minimal Test Output

Show only errors, suppress hook info logs (recommended for tests):

```bash
# .env.test
PAYLOAD_LOG_LEVEL=error
SUPPRESS_HOOK_LOGS=true
```

## Implementation Details

### Hook Logging Pattern

Hooks check the `SUPPRESS_HOOK_LOGS` environment variable before logging info messages:

```typescript
const suppressLogs = process.env.SUPPRESS_HOOK_LOGS === 'true'

try {
  if (!suppressLogs) {
    payload.logger.info(`Updating average price after clinic treatment change: ${doc.id}`)
  }
  
  // ... hook logic ...
} catch (error) {
  // Errors are always logged
  payload.logger.error('Error in hook', error)
}
```

### Payload Logger Configuration

The logger is configured in `src/payload.config.ts`:

```typescript
logger: {
  options: {
    level: process.env.PAYLOAD_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    name: 'findmydoc',
  },
}
```

## Testing the Configuration

Run the logging configuration tests to verify behavior:

```bash
pnpm tests --project=unit tests/unit/hooks/loggingConfiguration.test.ts
```

These tests verify:
- Info logs are suppressed when `SUPPRESS_HOOK_LOGS=true`
- Info logs are shown when `SUPPRESS_HOOK_LOGS=false`
- Error logs are always shown regardless of the setting

## Troubleshooting

### Tests are too noisy

Set `PAYLOAD_LOG_LEVEL=error` and `SUPPRESS_HOOK_LOGS=true` in `.env.test`.

### Need to debug a specific hook

Temporarily set `PAYLOAD_LOG_LEVEL=debug` and `SUPPRESS_HOOK_LOGS=false` in `.env.test`, then run the specific test.

### Production logs missing important information

Check that `PAYLOAD_LOG_LEVEL` is not set to `silent` or `error` in production.

## Related Files

- Configuration: `src/payload.config.ts`
- Environment: `.env.test`, `.env.example`
- Tests: `tests/unit/hooks/loggingConfiguration.test.ts`
- Documentation: `docs/testing/setup.md`
- Affected hooks:
  - `src/collections/ClinicTreatments/hooks/updateAveragePriceAfterChange.ts`
  - `src/collections/ClinicTreatments/hooks/updateAveragePriceAfterDelete.ts`
  - `src/hooks/calculations/updateAverageRatings.ts`
