import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const processDocument = readFileSync('docs/review-modification-process.md', 'utf8')

type MarkdownSection = {
  body: string
  title: string
}

type MarkdownTableRecord = Record<string, string>

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

const parseTableRecords = (section: string): MarkdownTableRecord[] => {
  const [headers, ...rows] = parseTable(section)
  if (!headers) throw new Error('Missing Markdown table')

  return rows.map(
    (row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) as MarkdownTableRecord,
  )
}

const parseTopLevelBullets = (section: string): string[] => {
  const bullets: string[] = []
  let activeIndex: number | undefined

  for (const line of section.split('\n')) {
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2))
      activeIndex = bullets.length - 1
      continue
    }

    if (line.trim() === '') {
      activeIndex = undefined
      continue
    }

    if (activeIndex !== undefined) {
      bullets[activeIndex] = `${bullets[activeIndex]} ${line.trim()}`
    }
  }

  return bullets.map(normalizeWhitespace)
}

const getBullet = (section: string, prefix: string): string => {
  const bullet = parseTopLevelBullets(section).find((candidate) => candidate.startsWith(prefix))
  if (!bullet) throw new Error(`Missing documentation bullet: ${prefix}`)
  return bullet
}

const getSentence = (source: string, marker: string): string => {
  const sentence = (source.match(/[^.]+(?:\.|$)/gu) ?? []).find((candidate) =>
    candidate.toLowerCase().includes(marker.toLowerCase()),
  )
  if (!sentence) throw new Error(`Missing documentation sentence: ${marker}`)
  return normalizeWhitespace(sentence)
}

const extractCodeTerms = (value: string): string[] =>
  [...value.matchAll(/`([^`]+)`/gu)].flatMap((match) =>
    (match[1] ?? '')
      .split('|')
      .map((term) => term.trim())
      .filter(Boolean),
  )

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

  it('binds each moderation measure to its public text, rating, and response behavior', () => {
    const rows = parseTableRecords(getSection('Public Moderation Measures'))
    const measures = Object.fromEntries(
      rows.map((row) => {
        const measure = extractCodeTerms(row.Measure ?? '')[0]
        if (!measure) throw new Error('Missing public moderation measure')

        const output = normalizeWhitespace(row['Public review output'] ?? '').toLowerCase()
        const fields = extractCodeTerms(row['Public review output'] ?? '')
        const outputMode = fields.includes('publicComment')
          ? 'redacted'
          : fields.includes('publicNotice')
            ? 'context'
            : fields.includes('comment')
              ? 'original'
              : output.includes('no review text')
                ? 'notice-only'
                : output.includes('omitted')
                  ? 'omitted'
                  : 'unknown'
        const notice = output.includes('fixed removal notice')
          ? 'removal'
          : output.includes('fixed neutral notice')
            ? 'neutral'
            : output.includes('factual') && fields.includes('publicNotice')
              ? 'context'
              : 'none'

        return [
          measure,
          {
            fields,
            metadata: normalizeWhitespace(row['Stars, count, date, and public author'] ?? '').toLowerCase(),
            notice,
            outputMode,
            response: normalizeWhitespace(row['Published clinic response'] ?? '')
              .toLowerCase()
              .startsWith('visible')
              ? 'visible'
              : normalizeWhitespace(row['Published clinic response'] ?? '').toLowerCase().startsWith('hidden')
                ? 'hidden'
                : 'unknown',
          },
        ]
      }),
    )

    expect(measures).toEqual({
      context: {
        fields: ['comment', 'publicNotice'],
        metadata: 'included',
        notice: 'context',
        outputMode: 'context',
        response: 'visible',
      },
      none: {
        fields: ['comment'],
        metadata: 'included',
        notice: 'none',
        outputMode: 'original',
        response: 'visible',
      },
      placeholder: {
        fields: [],
        metadata: 'included',
        notice: 'neutral',
        outputMode: 'notice-only',
        response: 'hidden',
      },
      redaction: {
        fields: ['publicComment'],
        metadata: 'included',
        notice: 'removal',
        outputMode: 'redacted',
        response: 'visible',
      },
      removed: {
        fields: [],
        metadata: 'excluded',
        notice: 'none',
        outputMode: 'omitted',
        response: 'hidden',
      },
    })
  })

  it('keeps dashboard history and current reads private, read-only, and current-safe', () => {
    const endpointRows = parseTableRecords(getSection('Endpoint Boundary'))
    const historyEndpoint = endpointRows.find((row) => (row.Endpoint ?? '').includes('/publication-history'))
    if (!historyEndpoint) throw new Error('Missing publication-history endpoint')

    const [method, endpointPath] = extractCodeTerms(historyEndpoint.Endpoint ?? '')[0]?.split(/\s+/u) ?? []
    const endpointRole = normalizeWhitespace(historyEndpoint['Process role'] ?? '').toLowerCase()
    expect({
      cache: endpointRole.includes('no-store') ? 'no-store' : 'unspecified',
      endpointPath,
      method,
      principals: ['platform staff', 'currently assigned clinic'].filter((principal) =>
        endpointRole.includes(principal),
      ),
      scope: ['tenant', 'current-safety'].filter((constraint) => endpointRole.includes(constraint)),
    }).toEqual({
      cache: 'no-store',
      endpointPath: '/api/reviews/:id/publication-history',
      method: 'GET',
      principals: ['platform staff', 'currently assigned clinic'],
      scope: ['tenant', 'current-safety'],
    })

    const moderationSection = getSection('Public Moderation Measures')
    const clinicCurrentRead = getBullet(moderationSection, 'Assigned clinic staff current reads')
    const retainedRows = getSentence(clinicCurrentRead, 'retain approved rows')
    expect(extractCodeTerms(retainedRows)).toEqual(['publicMeasure=removed', 'withdrawalState=withdrawn'])

    const readableProjectionFields = getSentence(clinicCurrentRead, 'They can read')
    expect(extractCodeTerms(readableProjectionFields)).toEqual([
      'publicMeasure',
      'publicComment',
      'publicNotice',
      'moderatedAt',
      'withdrawalState',
      'withdrawalSource',
      'withdrawnAt',
    ])

    const projectionVisibility = getSentence(clinicCurrentRead, 'do not mean')
    expect(
      ['stored fields', 'row or projection', 'still public'].filter((signal) =>
        projectionVisibility.toLowerCase().includes(signal),
      ),
    ).toEqual(['stored fields', 'row or projection', 'still public'])

    const rawCommentVisibility = getSentence(clinicCurrentRead, 'available only')
    expect(extractCodeTerms(rawCommentVisibility)).toEqual(['comment', 'none', 'context'])
    expect(
      ['active', 'not readable', 'redaction', 'placeholder', 'removal', 'withdrawal'].filter((signal) =>
        rawCommentVisibility.toLowerCase().includes(signal),
      ),
    ).toEqual(['active', 'not readable', 'redaction', 'placeholder', 'removal', 'withdrawal'])

    const omittedClinicData = getSentence(clinicCurrentRead, 'also omitted')
    expect(
      ['patient identity', 'internal reasons', 'named audit actors'].filter((field) =>
        omittedClinicData.toLowerCase().includes(field),
      ),
    ).toEqual(['patient identity', 'internal reasons', 'named audit actors'])

    const publicCurrentRead = getBullet(moderationSection, 'Patients and anonymous callers')
    const eligiblePublicRows = getSentence(publicCurrentRead, 'receive only approved')
    expect(extractCodeTerms(eligiblePublicRows)).toEqual(['none', 'context', 'redaction', 'placeholder'])
    expect(
      ['approved', 'active'].filter((state) => eligiblePublicRows.toLowerCase().includes(state)),
    ).toEqual(['approved', 'active'])

    const publicProjection = getSentence(publicCurrentRead, 'public projection only')
    expect(publicProjection.toLowerCase().includes('public projection only')).toBe(true)

    const absentPublicRows = getSentence(publicCurrentRead, 'absent in full')
    expect(
      ['removed', 'withdrawn', 'absent in full'].filter((state) =>
        absentPublicRows.toLowerCase().includes(state),
      ),
    ).toEqual(['removed', 'withdrawn', 'absent in full'])

    const reviewHistory = getBullet(getSection('Versioning and Audit'), 'Raw Review versions')
    const rawVersionAccess = getSentence(reviewHistory, 'platform-only')
    expect(
      ['raw review versions', 'platform-only'].filter((signal) =>
        rawVersionAccess.toLowerCase().includes(signal),
      ),
    ).toEqual(['raw review versions', 'platform-only'])

    const safeClinicHistory = getSentence(reviewHistory, 'currently safe public projection')
    expect(
      ['assigned clinic staff', 'sanitized publication-history', 'exactly match', 'currently safe public projection'].filter(
        (signal) => safeClinicHistory.toLowerCase().includes(signal),
      ),
    ).toEqual([
      'assigned clinic staff',
      'sanitized publication-history',
      'exactly match',
      'currently safe public projection',
    ])

    const hiddenHistory = getSentence(reviewHistory, 'no historical text')
    expect(
      ['removed', 'withdrawn', 'no historical text'].filter((signal) =>
        hiddenHistory.toLowerCase().includes(signal),
      ),
    ).toEqual(['removed', 'withdrawn', 'no historical text'])
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
