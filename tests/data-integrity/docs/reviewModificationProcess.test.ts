import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const processDocument = readFileSync('docs/review-modification-process.md', 'utf8')

type MarkdownSection = {
  body: string
  title: string
}

const parseSections = (source: string): MarkdownSection[] => {
  const headings = [...source.matchAll(/^## (.+)$/gmu)]

  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? source.length

    return {
      body: source.slice(start, end).trim(),
      title: (heading[1] ?? '').trim(),
    }
  })
}

const sections = parseSections(processDocument)

const getSection = (title: string): string => {
  const section = sections.find((candidate) => candidate.title === title)
  if (!section) throw new Error(`Missing documentation section: ${title}`)
  return section.body
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/gu, ' ').trim()

const extractCodeUnion = (section: string, field: string): string[] => {
  const lines = section.split('\n')
  const start = lines.findIndex((line) => line.startsWith(`- \`${field}\``))
  if (start < 0) throw new Error(`Missing state definition for ${field}`)

  const definition = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined) break
    if (index > start && (line === '' || line.startsWith('- `'))) break
    definition.push(line)
  }

  const union = [...definition.join(' ').matchAll(/`([^`]+\|[^`]+)`/gu)][0]?.[1]
  if (!union) throw new Error(`Missing state values for ${field}`)

  return union.split('|').map((value) => value.trim())
}

const parseTable = (section: string): string[][] =>
  section
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((row) => !row.every((cell) => /^-+$/u.test(cell)))

describe('review modification process documentation contract', () => {
  it('keeps approval, public treatment, and withdrawal as separate state machines', () => {
    const domainContract = getSection('Domain Contract')

    expect({
      publicMeasure: extractCodeUnion(domainContract, 'publicMeasure'),
      status: extractCodeUnion(domainContract, 'status'),
      withdrawalState: extractCodeUnion(domainContract, 'withdrawalState'),
    }).toEqual({
      publicMeasure: ['none', 'context', 'redaction', 'placeholder', 'removed'],
      status: ['pending', 'approved', 'rejected'],
      withdrawalState: ['active', 'withdrawn'],
    })

    const independenceSignals = ['independent', 'appeal decision', 'does not set']
    const normalizedContract = normalizeWhitespace(domainContract).toLowerCase()
    expect(independenceSignals.filter((signal) => normalizedContract.includes(signal))).toEqual(independenceSignals)
  })

  it('defines public behavior for every supported moderation measure', () => {
    const rows = parseTable(getSection('Public Moderation Measures')).slice(1)
    const measures = rows.map((row) => row[0]?.match(/^`([^`]+)`$/u)?.[1])

    expect(measures).toEqual(['none', 'context', 'redaction', 'placeholder', 'removed'])
    expect(rows.every((row) => row.length === 4 && row.every(Boolean))).toBe(true)
  })

  it('keeps publication history read-only, private, tenant-scoped, and visibility-filtered', () => {
    const endpointRows = parseTable(getSection('Endpoint Boundary')).slice(1)
    const historyRows = endpointRows.filter((row) => row[0]?.includes('/publication-history'))
    const methods = historyRows.map((row) => row[0]?.match(/`([A-Z]+)\s/u)?.[1])
    const endpointRole = normalizeWhitespace(historyRows[0]?.[1] ?? '').toLowerCase()
    const endpointSignals = ['private', 'no-store', 'platform staff', 'currently assigned clinic', 'tenant', 'current-safety']

    expect(methods).toEqual(['GET'])
    expect(endpointSignals.filter((signal) => endpointRole.includes(signal))).toEqual(endpointSignals)

    const versioning = normalizeWhitespace(getSection('Versioning and Audit')).toLowerCase()
    const visibilitySignals = [
      'sanitized publication-history endpoint',
      'currently safe public projection',
      'removed or withdrawn current state',
      'no historical text',
    ]
    expect(visibilitySignals.filter((signal) => versioning.includes(signal))).toEqual(visibilitySignals)
  })

  it('references the Trust Core only at the policy boundary and forbids evidence storage', () => {
    expect(sections.filter((section) => /\bTrust Core\b/u.test(section.body)).map((section) => section.title)).toEqual([
      'Purpose and Policy Boundary',
    ])

    const policyBoundary = normalizeWhitespace(getSection('Purpose and Policy Boundary')).toLowerCase()
    const boundarySignals = ['source of truth', 'without duplicating', 'must not request or store', 'proof uploads', 'evidence fields']
    expect(boundarySignals.filter((signal) => policyBoundary.includes(signal))).toEqual(boundarySignals)
  })
})
