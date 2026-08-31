export const PAYLOAD_RUNTIME_POOL_POLICY = {
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 10_000,
  max: 4,
} as const

const PAYLOAD_DATABASE_MIGRATION_OPERATION = 'migration'

const isVercelRuntime = (env: Partial<NodeJS.ProcessEnv>): boolean =>
  env.VERCEL === '1' || env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'production'

const assertVercelTransactionPooler = (connectionString: string, env: Partial<NodeJS.ProcessEnv>): void => {
  const isMigrationChild = env.PAYLOAD_DATABASE_OPERATION === PAYLOAD_DATABASE_MIGRATION_OPERATION
  if (!isVercelRuntime(env) || isMigrationChild) return

  let port: string
  try {
    port = new URL(connectionString).port
  } catch {
    port = ''
  }

  if (port !== '6543') {
    throw new Error('DATABASE_URI must use a transaction pooler on port 6543 in Vercel runtimes.')
  }
}

export const createPayloadRuntimePoolConfig = (env: Partial<NodeJS.ProcessEnv> = process.env) => {
  const connectionString = env.DATABASE_URI?.trim() ?? ''
  assertVercelTransactionPooler(connectionString, env)

  return {
    connectionString,
    ...PAYLOAD_RUNTIME_POOL_POLICY,
  }
}
