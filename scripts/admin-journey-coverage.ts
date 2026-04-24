import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { listAdminJourneys } from '../tests/e2e/helpers/adminJourneys'
import { permissionMatrix } from '../src/security/permission-matrix.config'
import type { AdminJourneyMetadata, AdminJourneyPersona } from '../tests/e2e/helpers/adminJourneys'

export type AdminJourneyCoverageReport = ReturnType<typeof buildAdminJourneyCoverageReport>

type AdminJourneyCoverageSource = {
  journeyId: string
  metadata: AdminJourneyMetadata
  persona: AdminJourneyPersona
  steps: readonly unknown[]
}

const toSortedUnique = (values: Iterable<string>) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

export const getDefaultAdminJourneyCoverageOutputRoot = () => path.join('output', 'playwright', 'journey-coverage')

export const buildAdminJourneyCoverageReport = (
  journeys: AdminJourneyCoverageSource[] = listAdminJourneys(),
  collectionRows = Object.values(permissionMatrix.collections),
) => {
  const collectionCoverage = collectionRows.map((collection) => {
    const coveringJourneys = journeys.filter((journey) => journey.metadata.collections.includes(collection.slug))

    return {
      collection: collection.slug,
      consumers: toSortedUnique(coveringJourneys.flatMap((journey) => journey.metadata.consumers)),
      displayName: collection.displayName,
      entrypoints: toSortedUnique(coveringJourneys.flatMap((journey) => journey.metadata.entrypoints)),
      journeyIds: coveringJourneys.map((journey) => journey.journeyId).sort((a, b) => a.localeCompare(b)),
      personas: toSortedUnique(coveringJourneys.map((journey) => journey.persona)),
      riskTags: toSortedUnique(coveringJourneys.flatMap((journey) => journey.metadata.riskTags)),
    }
  })

  const uncoveredCollections = collectionCoverage
    .filter((collection) => collection.journeyIds.length === 0)
    .map((collection) => collection.collection)

  return {
    collections: collectionCoverage,
    generatedAt: new Date().toISOString(),
    journeys: journeys
      .map((journey) => ({
        collections: [...journey.metadata.collections].sort((a, b) => a.localeCompare(b)),
        consumers: [...journey.metadata.consumers],
        entrypoints: [...journey.metadata.entrypoints],
        journeyId: journey.journeyId,
        persona: journey.persona,
        riskTags: [...journey.metadata.riskTags].sort((a, b) => a.localeCompare(b)),
        stepCount: journey.steps.length,
      }))
      .sort((a, b) => a.journeyId.localeCompare(b.journeyId)),
    summary: {
      coveredCollections: collectionCoverage.length - uncoveredCollections.length,
      totalCollections: collectionCoverage.length,
      totalJourneys: journeys.length,
      uncoveredCollections,
    },
  }
}

export const buildAdminJourneyCoverageMarkdown = (report: AdminJourneyCoverageReport) => {
  const lines = [
    '# Admin Journey Coverage',
    '',
    `Generated at: ${report.generatedAt}`,
    '',
    `Collections covered: ${report.summary.coveredCollections}/${report.summary.totalCollections}`,
    `Registered journeys: ${report.summary.totalJourneys}`,
    '',
    '| Collection | Journeys | Personas | Consumers | Entrypoints | Risk Tags |',
    '| --- | ---: | --- | --- | --- | --- |',
  ]

  for (const collection of report.collections) {
    lines.push(
      `| ${[
        `\`${collection.collection}\``,
        String(collection.journeyIds.length),
        collection.personas.join(', ') || '-',
        collection.consumers.join(', ') || '-',
        collection.entrypoints.join(', ') || '-',
        collection.riskTags.join(', ') || '-',
      ].join(' | ')} |`,
    )
  }

  lines.push('')
  lines.push('## Uncovered Collections')
  lines.push('')

  if (report.summary.uncoveredCollections.length === 0) {
    lines.push('All permission-matrix collections have at least one admin journey.')
  } else {
    for (const collection of report.summary.uncoveredCollections) {
      lines.push(`- \`${collection}\``)
    }
  }

  return `${lines.join('\n')}\n`
}

const parseOutputRoot = (argv: string[]) => {
  const outputRootIndex = argv.indexOf('--output-root')
  if (outputRootIndex !== -1) {
    return argv[outputRootIndex + 1] ?? getDefaultAdminJourneyCoverageOutputRoot()
  }

  const outputRootArg = argv.find((arg) => arg.startsWith('--output-root='))
  if (outputRootArg) {
    return outputRootArg.slice('--output-root='.length)
  }

  return getDefaultAdminJourneyCoverageOutputRoot()
}

export const writeAdminJourneyCoverageReport = async (argv: string[] = process.argv.slice(2)) => {
  const outputRoot = path.resolve(process.cwd(), parseOutputRoot(argv))
  const report = buildAdminJourneyCoverageReport()
  const jsonPath = path.join(outputRoot, 'coverage.json')
  const markdownPath = path.join(outputRoot, 'coverage.md')

  await mkdir(outputRoot, { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, buildAdminJourneyCoverageMarkdown(report), 'utf8')

  console.log(`Admin journey coverage JSON written to ${path.relative(process.cwd(), jsonPath)}`)
  console.log(`Admin journey coverage markdown written to ${path.relative(process.cwd(), markdownPath)}`)
}

const isDirectExecution = () => {
  const entryPoint = process.argv[1]

  if (!entryPoint) {
    return false
  }

  return import.meta.url === pathToFileURL(entryPoint).href
}

if (isDirectExecution()) {
  writeAdminJourneyCoverageReport().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
