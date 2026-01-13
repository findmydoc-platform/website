import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type SeedKind = 'baseline' | 'demo'

type SeedRecord = Record<string, unknown> & { stableId: string }

const seedDataRoot = resolve(process.cwd(), 'src/endpoints/seed/data')

function ensureStableId(value: unknown, index: number, fileName: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Seed file ${fileName} is missing stableId for item ${index}`)
  }
  return value
}

export async function loadSeedFile(kind: SeedKind, name: string): Promise<SeedRecord[]> {
  const filePath = resolve(seedDataRoot, kind, `${name}.json`)
  const raw = await readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error(`Seed file ${filePath} must contain a JSON array`)
  }

  const seen = new Set<string>()
  const records = parsed.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Seed file ${filePath} must contain objects, item ${index} is invalid`)
    }
    const record = item as Record<string, unknown>
    const stableId = ensureStableId(record.stableId, index, filePath)
    if (seen.has(stableId)) {
      throw new Error(`Seed file ${filePath} has duplicate stableId ${stableId}`)
    }
    seen.add(stableId)
    return { ...record, stableId } as SeedRecord
  })

  return records
}

export type { SeedKind, SeedRecord }
