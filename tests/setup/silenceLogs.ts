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

if (!SHOW_LOGS) {
  // Save originals in case other setup needs to restore them
  ;(global as any).__originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
    trace: console.trace,
    dir: (console as any).dir,
  }

  // Replace with no-op functions
  console.log = () => {}
  console.info = () => {}
  console.warn = () => {}
  // keep console.error intact so runtime errors and stack traces are visible
  // console.error = () => {}
  console.debug = () => {}
  console.trace = () => {}
  ;(console as any).dir = () => {}
}

// Optional helper: restore original console if any teardown needs it
export function restoreConsole() {
  const orig = (global as any).__originalConsole
  if (!orig) return
  console.log = orig.log
  console.info = orig.info
  console.warn = orig.warn
  console.error = orig.error
  console.debug = orig.debug
  console.trace = orig.trace
  ;(console as any).dir = orig.dir || (() => {})
  delete (global as any).__originalConsole
}
