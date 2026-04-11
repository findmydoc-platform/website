import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { collectionContractRegistry, deepContractDomains } from './collectionContractRegistry'

const repositoryRoot = process.cwd()
const collectionsRoot = path.join(repositoryRoot, 'src/collections')

const walkFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }

  return files
}

const readCollectionSlugsFromSource = (): string[] => {
  const slugSet = new Set<string>()
  const files = walkFiles(collectionsRoot)

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8')
    const matches = source.matchAll(/slug:\s*'([^']+)'/g)
    for (const match of matches) {
      const slug = match[1]
      if (slug) slugSet.add(slug)
    }
  }

  return [...slugSet].sort()
}

describe('Collection contract coverage gate', () => {
  it('keeps registry slugs in sync with src/collections', () => {
    const sourceSlugs = readCollectionSlugsFromSource()
    const registrySlugs = Object.keys(collectionContractRegistry).sort()

    expect(registrySlugs).toEqual(sourceSlugs)
  })

  it('references existing integration tests for each registered collection', () => {
    for (const [slug, entry] of Object.entries(collectionContractRegistry)) {
      expect(entry.baseline.length, `${slug} requires at least one baseline test reference`).toBeGreaterThan(0)

      const deepReferences = 'deep' in entry ? entry.deep : undefined
      for (const relativePath of [...entry.baseline, ...(deepReferences ?? [])]) {
        const absolutePath = path.join(repositoryRoot, relativePath)
        expect(fs.existsSync(absolutePath), `${slug} references missing test: ${relativePath}`).toBe(true)
      }
    }
  })

  it('keeps deep-domain slugs mapped to deep contract references', () => {
    for (const [domain, slugs] of Object.entries(deepContractDomains)) {
      for (const slug of slugs) {
        const entry = collectionContractRegistry[slug]
        const deepReferences = entry && 'deep' in entry ? entry.deep : undefined
        expect(entry, `${domain} references unknown slug "${slug}"`).toBeDefined()
        expect(deepReferences?.length ?? 0, `${slug} in ${domain} requires deep test references`).toBeGreaterThan(0)
      }
    }
  })
})
