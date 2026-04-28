import path from 'node:path'

export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), 'output/playwright')
export const E2E_REPORT_DIR = path.join(E2E_OUTPUT_DIR, 'report')
export const E2E_SESSION_DIR = path.join(E2E_OUTPUT_DIR, 'sessions')
export const E2E_ADMIN_SESSION_FILE = path.join(E2E_SESSION_DIR, 'admin.e2e.json')
export const E2E_CLINIC_SESSION_FILE = path.join(E2E_SESSION_DIR, 'clinic.e2e.json')
