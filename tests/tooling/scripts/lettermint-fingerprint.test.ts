import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readConcealedInput,
  recordFingerprint,
  recordFingerprintFile,
} from '../../../scripts/lettermint-fingerprint.mjs'
import {
  formatDigestKeyRetirementFailure,
  parseDigestKeyRetirementArgs,
  removeApprovedDigestFingerprintFile,
} from '../../../scripts/lettermint-digest-key-retirement'
import { DigestKeyRetirementBlockedError } from '../../../src/features/transactionalEmail/digestKeyRotation'

const synthetic = 'lm_synthetic_token_for_preview'
const registry = () => ({
  targets: [
    {
      environment: 'preview',
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'preview-route',
      routeSlug: 'preview-route-slug',
      webhookId: 'preview-webhook',
      sender: 'preview@example.test',
      senderEvidenceId: 'preview-sender-evidence',
      digestKeyId: 'preview-digest-key',
      activatedTarget: null,
    },
  ],
  fingerprints: [],
})
const targetLocks = () => ({
  targets: [
    {
      environment: 'preview',
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'preview-route',
      routeSlug: 'preview-route-slug',
    },
  ],
})
const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Lettermint fingerprint setup', () => {
  it('writes only a full SHA-256 fingerprint and reviewed non-secret target metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lettermint-fingerprint-'))
    directories.push(directory)
    const path = join(directory, 'registry.json')
    await writeFile(path, JSON.stringify(registry()))
    await recordFingerprintFile(path, { environment: 'preview', kind: 'project-token' }, synthetic, targetLocks())
    const raw = await readFile(path, 'utf8')
    expect(raw).not.toContain(synthetic)
    expect(JSON.parse(raw).fingerprints).toEqual([
      {
        environment: 'preview',
        kind: 'project-token',
        bindingId: 'project-token-preview',
        sha256: 'b2fc7233eb6d2693f4dc619d4060757312da5422ab75e630c8c138c728676089', // pragma: allowlist secret
        teamId: 'preview-team',
        projectId: 'preview-project',
        routeId: 'preview-route',
        routeSlug: 'preview-route-slug',
        webhookId: null,
        overlap: null,
      },
    ])
    expect(JSON.parse(raw).targets[0].activatedTarget).toEqual({
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'preview-route',
      routeSlug: 'preview-route-slug',
    })
  })

  it('allows same-target rotation and rejects target drift after activation', () => {
    const first = recordFingerprint(
      registry(),
      { environment: 'preview', kind: 'project-token' },
      synthetic,
      targetLocks(),
    )
    const rotated = recordFingerprint(
      first,
      { environment: 'preview', kind: 'project-token' },
      'lm_another_synthetic_token',
      targetLocks(),
    )
    expect(rotated.fingerprints).toHaveLength(1)
    expect(rotated.fingerprints[0].sha256).not.toBe(first.fingerprints[0].sha256)
    const changed = {
      ...first,
      targets: [
        {
          ...first.targets[0],
          routeId: 'different-route',
        },
      ],
    }
    expect(() =>
      recordFingerprint(changed, { environment: 'preview', kind: 'project-token' }, synthetic, targetLocks()),
    ).toThrow('Invalid Lettermint fingerprint setup')
    changed.targets[0].activatedTarget = {
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'different-route',
      routeSlug: 'preview-route-slug',
    }
    expect(() =>
      recordFingerprint(changed, { environment: 'preview', kind: 'project-token' }, synthetic, targetLocks()),
    ).toThrow('Invalid Lettermint fingerprint setup')
  })

  it('retains an explicitly versioned digest fingerprint when the reviewed current version rotates', () => {
    const first = recordFingerprint(
      registry(),
      { environment: 'preview', kind: 'digest-key' },
      'synthetic-preview-digest-key-v1',
      targetLocks(),
    )
    expect(first.fingerprints).toEqual([
      expect.objectContaining({
        bindingId: 'digest-key-preview-preview-digest-key',
        digestKeyId: 'preview-digest-key',
      }),
    ])

    first.targets[0].digestKeyId = 'preview-digest-key-v2'
    const rotated = recordFingerprint(
      first,
      { environment: 'preview', kind: 'digest-key' },
      'synthetic-preview-digest-key-v2',
      targetLocks(),
    )
    expect(rotated.fingerprints).toEqual([
      expect.objectContaining({ digestKeyId: 'preview-digest-key' }),
      expect.objectContaining({
        bindingId: 'digest-key-preview-preview-digest-key-v2',
        digestKeyId: 'preview-digest-key-v2',
      }),
    ])

    expect(() =>
      recordFingerprint(
        rotated,
        { environment: 'preview', kind: 'digest-key' },
        'synthetic-preview-digest-key-v1',
        targetLocks(),
      ),
    ).toThrow('Invalid Lettermint fingerprint setup')
  })

  it('rejects a shared fingerprint or an excessive previous-secret window', () => {
    const first = recordFingerprint(
      registry(),
      { environment: 'preview', kind: 'project-token' },
      synthetic,
      targetLocks(),
    )
    first.targets.push({ ...first.targets[0], environment: 'production' })
    expect(() =>
      recordFingerprint(first, { environment: 'production', kind: 'project-token' }, synthetic, targetLocks()),
    ).toThrow('Invalid Lettermint fingerprint setup')
    expect(() =>
      recordFingerprint(
        first,
        {
          environment: 'preview',
          kind: 'webhook-previous',
          startsAt: '2026-09-25T12:00:00.000Z',
          validUntil: '2026-09-25T12:10:01.000Z',
        },
        'synthetic-previous-webhook-secret',
        targetLocks(),
      ),
    ).toThrow('Invalid Lettermint fingerprint setup')
  })

  it('conceals terminal input and never echoes credential bytes', async () => {
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode(value: boolean) {
        this.rawMode = value
      },
      rawMode: false,
    })
    const output = new PassThrough()
    let visible = ''
    output.on('data', (chunk) => {
      visible += String(chunk)
    })
    const pending = readConcealedInput(
      input as unknown as typeof process.stdin,
      output as unknown as typeof process.stdout,
    )
    input.write('synthetic-hidden-value\r')
    expect(await pending).toBe('synthetic-hidden-value')
    expect(visible).not.toContain('synthetic-hidden-value')
    expect(input.rawMode).toBe(false)
  })
})

describe('Lettermint digest-key retirement command', () => {
  it('parses exactly one hosted environment and previous digest version', () => {
    expect(
      parseDigestKeyRetirementArgs(['--', '--environment', 'preview', '--version', 'preview-digest-key-v1']),
    ).toEqual({ environment: 'preview', version: 'preview-digest-key-v1' })
    expect(() => parseDigestKeyRetirementArgs(['--environment', 'local', '--version', 'digest-v1'])).toThrow(
      'Invalid digest-key retirement request',
    )
    expect(() => parseDigestKeyRetirementArgs(['--environment', 'preview'])).toThrow(
      'Invalid digest-key retirement request',
    )
  })

  it('atomically removes only the fingerprint covered by the successful database approval', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lettermint-digest-retirement-'))
    directories.push(directory)
    const path = join(directory, 'registry.json')
    const previous = {
      environment: 'preview',
      kind: 'digest-key',
      bindingId: 'digest-key-preview-v1',
      sha256: 'a'.repeat(64),
      digestKeyId: 'preview-v1',
    }
    const current = {
      ...previous,
      bindingId: 'digest-key-preview-v2',
      sha256: 'b'.repeat(64),
      digestKeyId: 'preview-v2',
    }
    await writeFile(path, `${JSON.stringify({ targets: registry().targets, fingerprints: [previous, current] })}\n`)

    await removeApprovedDigestFingerprintFile(path, {
      environment: 'preview',
      version: 'preview-v1',
      fingerprint: { bindingId: previous.bindingId, sha256: previous.sha256, version: 'preview-v1' },
    })
    expect(JSON.parse(await readFile(path, 'utf8')).fingerprints).toEqual([current])
  })

  it('leaves the registry unchanged when approval evidence does not match the exact fingerprint', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lettermint-digest-retirement-'))
    directories.push(directory)
    const path = join(directory, 'registry.json')
    const contents = JSON.stringify({
      targets: registry().targets,
      fingerprints: [
        {
          environment: 'preview',
          kind: 'digest-key',
          bindingId: 'digest-key-preview-v1',
          sha256: 'a'.repeat(64),
          digestKeyId: 'preview-v1',
        },
      ],
    })
    await writeFile(path, `${contents}\n`)

    await expect(
      removeApprovedDigestFingerprintFile(path, {
        environment: 'preview',
        version: 'preview-v1',
        fingerprint: { bindingId: 'digest-key-preview-v1', sha256: 'b'.repeat(64), version: 'preview-v1' },
      }),
    ).rejects.toThrow('Digest-key retirement failed')
    expect(await readFile(path, 'utf8')).toBe(`${contents}\n`)
  })

  it('renders only non-secret retirement evidence and hides unexpected failure details', () => {
    expect(
      formatDigestKeyRetirementFailure(
        new DigestKeyRetirementBlockedError({
          environment: 'preview',
          version: 'preview-v1',
          outboxRecords: 1,
          suppressionRecords: 2,
          previewAllowlistEntries: 3,
        }),
      ),
    ).toBe(
      'Digest-key retirement blocked: environment=preview version=preview-v1 outbox=1 suppressions=2 previewAllowlist=3.',
    )
    expect(formatDigestKeyRetirementFailure(new Error('synthetic-private-retirement-detail'))).toBe(
      'Digest-key retirement failed.',
    )
  })
})
