// tests/setup/silenceLogs.ts
/**
 * Silence console.* during tests by default.
 * To opt-in to logs when running tests, set TEST_SHOW_LOGS=1 or TEST_SHOW_LOGS=true
 * on the test command (there is a package script `tests:show-logs` added).
 *
 * This file intentionally does NOT modify PAYLOAD_LOG_LEVEL — that is controlled
 * centrally in `src/payload.config.ts`.
 */

const SHOW_LOGS = (process.env.TEST_SHOW_LOGS || '').toLowerCase() === 'true' || process.env.TEST_SHOW_LOGS === '1'

type OriginalConsole = {
  log: typeof console.log
  info: typeof console.info
  warn: typeof console.warn
  error: typeof console.error
  debug: typeof console.debug
  trace: typeof console.trace
  dir?: typeof console.dir
}

// Use a typed holder on globalThis to avoid `any` casts
type GlobalHolder = {
  __originalConsole?: OriginalConsole
}

const globalHolder = globalThis as unknown as GlobalHolder

if (!SHOW_LOGS) {
  // Save originals in case other setup needs to restore them
  globalHolder.__originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    trace: console.trace,
    dir: console.dir,
  }

  // Replace with no-op functions (but keep console.error intact so runtime errors are visible)
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  // console.error intentionally preserved
  console.debug = () => {}
  console.trace = () => {}
  // console.dir is optional on some environments; guard access
  if (typeof console.dir === 'function') console.dir = () => {}
}

// Optional helper: restore original console if any teardown needs it
export function restoreConsole() {
  const orig = globalHolder.__originalConsole
  if (!orig) return
  console.log = orig.log
  console.info = orig.info
  console.warn = orig.warn
  console.error = orig.error
  console.debug = orig.debug
  console.trace = orig.trace
  if (orig.dir) console.dir = orig.dir
  delete globalHolder.__originalConsole
}
