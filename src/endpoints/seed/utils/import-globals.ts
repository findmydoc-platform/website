import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Payload } from 'payload'

type ConfiguredGlobalSlug = Payload['config']['globals'][number]['slug']

export type GlobalSeedRecord = {
  slug: string
  data: Record<string, unknown>
}

const seedDataRoot = resolve(process.cwd(), 'src/endpoints/seed/data')

export async function importGlobals(payload: Payload): Promise<{
  created: number
  updated: number
  warnings: string[]
  failures: string[]
}> {
  const filePath = resolve(seedDataRoot, 'baseline', 'globals.json')
  const raw = await readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error(`Globals seed file ${filePath} must contain a JSON array`)
  }

  const warnings: string[] = []
  const failures: string[] = []
  let updated = 0
  const allowedSlugs = payload.config?.globals?.map((global) => global.slug) ?? []

  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      warnings.push('Globals seed entry is not an object')
      continue
    }

    const record = entry as GlobalSeedRecord
    if (!record.slug || typeof record.slug !== 'string') {
      warnings.push('Globals seed entry is missing a slug')
      continue
    }

    const slug = record.slug as ConfiguredGlobalSlug
    if (allowedSlugs.length > 0 && !allowedSlugs.includes(slug)) {
      warnings.push(`Globals seed entry slug ${record.slug} is not registered in Payload config`)
      continue
    }

    try {
      await payload.updateGlobal({
        slug,
        data: record.data,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Failed global ${record.slug}: ${message}`)
    }
  }

  return {
    created: 0,
    updated,
    warnings,
    failures,
  }
}
