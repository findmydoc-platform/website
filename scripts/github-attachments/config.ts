import path from 'node:path'

export const GITHUB_ORIGIN = 'https://github.com'
export const DEFAULT_STATE_FILE = path.join('tmp', 'github-attachments', 'github.storage-state.json')
export const DEFAULT_TMP_DIR = path.join('tmp', 'github-attachments')
export const DEFAULT_DISCOVERY_PROBE_FILE = path.join(DEFAULT_TMP_DIR, 'upload-token-probe.png')

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

export const LOGIN_URL = 'https://github.com/login'
