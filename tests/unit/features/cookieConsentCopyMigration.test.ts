import { describe, expect, it, vi } from 'vitest'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { up } from '@/migrations/20261111_145406_cookie_consent_approved_prompt'

const oldStock = {
  id: 1,
  bannerTitle: 'Cookies on findmydoc',
  bannerDescription:
    'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.',
  acceptLabel: 'Accept all',
  rejectLabel: 'Reject all',
  customizeLabel: 'Customize',
  consentVersion: 3,
}

function migrationBoundary(initial: Record<string, unknown>) {
  let stored = { ...initial }
  const updateGlobal = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    stored = { ...stored, ...data }
    return stored
  })
  const warn = vi.fn()
  const args = {
    db: { execute: vi.fn() },
    payload: { findGlobal: async () => stored, updateGlobal, logger: { warn } },
    req: { context: {} },
  } as unknown as MigrateUpArgs
  return { args, updateGlobal, warn, read: () => stored }
}

describe('approved consent copy migration', () => {
  it('adopts unchanged stock copy through Payload without changing the consent version', async () => {
    const boundary = migrationBoundary(oldStock)
    await up(boundary.args)
    expect(boundary.read()).toMatchObject({
      bannerTitle: 'Help us improve findmydoc',
      customizeLabel: 'Settings',
      consentVersion: 3,
      germanPrompt: {
        bannerTitle: 'Hilf uns, findmydoc zu verbessern',
        bannerDescription:
          'Mit deiner Einwilligung werten wir Seitenaufrufe und Klicks aus, erkennen technische Fehler und zeichnen Nutzungssitzungen auf. So erkennen wir, wo findmydoc schwer zu bedienen ist. Du kannst die Website auch ohne diese Auswertung nutzen und deine Auswahl jederzeit in den Cookie-Einstellungen ändern.',
        acceptLabel: 'Alle akzeptieren',
        rejectLabel: 'Alle ablehnen',
        customizeLabel: 'Einstellungen',
      },
    })
    expect(boundary.read().bannerDescription).toBe(
      'With your consent, we analyse page views and clicks, detect technical errors and record browsing sessions. This helps us identify where findmydoc is difficult to use. You can use the website without this analysis and change your choice at any time in Cookie settings.',
    )
    await up(boundary.args)
    expect(boundary.updateGlobal).toHaveBeenCalledTimes(1)
  })
  it('preserves individually edited copy and reports only the differing field names', async () => {
    const boundary = migrationBoundary({
      ...oldStock,
      bannerTitle: 'Operator-specific title',
      rejectLabel: 'Continue without analysis',
      germanPrompt: { bannerTitle: 'Eigener Titel' },
    })
    await up(boundary.args)
    expect(boundary.read()).toMatchObject({
      bannerTitle: 'Operator-specific title',
      rejectLabel: 'Continue without analysis',
      germanPrompt: { bannerTitle: 'Eigener Titel', acceptLabel: 'Alle akzeptieren' },
    })
    expect(boundary.warn).toHaveBeenCalledWith(
      { fields: ['bannerTitle', 'rejectLabel', 'germanPrompt.bannerTitle'] },
      expect.any(String),
    )
    expect(JSON.stringify(boundary.warn.mock.calls)).not.toContain('Operator-specific')
  })
})
