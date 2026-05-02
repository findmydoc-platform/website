import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const mediaSeedFiles = [
  'src/endpoints/seed/data/baseline/platformContentMedia.json',
  'src/endpoints/seed/data/demo/clinicMedia.json',
  'src/endpoints/seed/data/demo/platformContentMedia.json',
  'src/endpoints/seed/data/demo/userProfileMedia.json',
] as const

type SeedMediaRecord = {
  filePath?: string
  stableId?: string
}

describe('seed media assets', () => {
  it('keeps media file paths aligned with existing seed assets', () => {
    const missingFiles = mediaSeedFiles.flatMap((seedFile) => {
      const records = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as SeedMediaRecord[]

      return records.flatMap((record) => {
        if (!record.filePath) return []

        const resolvedPath = path.resolve(process.cwd(), record.filePath)

        return fs.existsSync(resolvedPath) ? [] : [`${seedFile}:${record.stableId ?? 'unknown'} -> ${record.filePath}`]
      })
    })

    expect(missingFiles).toEqual([])
  })
})
