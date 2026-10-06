import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile, readdir, lstat, rm } from 'node:fs/promises'
import { spawn, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'

// Compiler packs include the Server Actions key in loader options and cache versions.
// Only authenticated ciphertext reaches Actions cache storage.
const { values } = parseArgs({ options: { command: { type: 'string' } } })
const root = process.env.RUNNER_TEMP
if (
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.CI_CACHE_EXPERIMENT !== '1' ||
  !root ||
  !process.env.PAYLOAD_SECRET ||
  !/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? '')
)
  throw new Error('Sealed cache requires opted-in CI and secret inputs')
const directory = join(root, 'ci-cache-sealed')
const key = createHmac('sha256', process.env.PAYLOAD_SECRET)
  .update(`ci-cache-seal-v1:${process.env.GITHUB_SHA}`)
  .digest()
const bundle = join(directory, 'compiler.bin')
const metadata = join(directory, 'envelope.json')
async function regularTree(path) {
  const stat = await lstat(path)
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('Unsupported cache entry')
  if (stat.isDirectory()) for (const name of await readdir(path)) await regularTree(join(path, name))
}
try {
  if (values.command === 'seal') {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const paths = []
    for (const name of ['webpack', 'swc']) {
      try {
        await regularTree(join('.next/cache', name))
        paths.push(name)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    if (!paths.length) throw new Error('No compiler cache to seal')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(Buffer.from(process.env.GITHUB_SHA))
    const child = spawn('tar', ['--create', '--gzip', '--file', '-', '--directory', '.next/cache', ...paths], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const closed = new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) => (code === 0 ? resolve() : reject(new Error('Archive failed'))))
    })
    await Promise.all([pipeline(child.stdout, cipher, createWriteStream(bundle, { mode: 0o600 })), closed])
    await writeFile(
      metadata,
      JSON.stringify({ version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex') }),
      { mode: 0o600 },
    )
  } else if (values.command === 'unseal') {
    const envelope = JSON.parse(await readFile(metadata, 'utf8'))
    if (envelope.version !== 1 || !/^[a-f0-9]{24}$/.test(envelope.iv) || !/^[a-f0-9]{32}$/.test(envelope.tag))
      throw new Error('Invalid sealed envelope')
    const archive = join(root, 'ci-cache-private.tar.gz')
    const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'))
    cipher.setAuthTag(Buffer.from(envelope.tag, 'hex'))
    cipher.setAAD(Buffer.from(process.env.GITHUB_SHA))
    try {
      await pipeline(createReadStream(bundle), cipher, createWriteStream(archive, { mode: 0o600 }))
      const entries = execFileSync('tar', ['--list', '--gzip', '--file', archive], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      })
        .trim()
        .split('\n')
      if (entries.some((name) => !/^(webpack|swc)(\/|$)/.test(name) || name.split('/').includes('..')))
        throw new Error('Invalid archive paths')
      await mkdir('.next/cache', { recursive: true })
      execFileSync('tar', ['--extract', '--gzip', '--file', archive, '--directory', '.next/cache'], { stdio: 'ignore' })
      for (const name of ['webpack', 'swc']) {
        try {
          await regularTree(join('.next/cache', name))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
    } finally {
      await rm(archive, { force: true })
    }
  } else throw new Error('Unknown sealed cache command')
} catch {
  console.error('Sealed compiler cache operation failed; private contents withheld.')
  process.exitCode = 1
} finally {
  key.fill(0)
}
