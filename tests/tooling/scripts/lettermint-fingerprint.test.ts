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

const synthetic = 'lm_synthetic_token_for_preview'
const registry = () => ({
  targets: [
    {
      environment: 'preview',
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'preview-route',
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
  targets: [{ environment: 'preview', teamId: 'preview-team', projectId: 'preview-project', routeId: 'preview-route' }],
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
        webhookId: null,
        overlap: null,
      },
    ])
    expect(JSON.parse(raw).targets[0].activatedTarget).toEqual({
      teamId: 'preview-team',
      projectId: 'preview-project',
      routeId: 'preview-route',
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
    }
    expect(() =>
      recordFingerprint(changed, { environment: 'preview', kind: 'project-token' }, synthetic, targetLocks()),
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
