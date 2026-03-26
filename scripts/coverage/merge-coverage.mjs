import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const args = process.argv.slice(2)

const readArg = (name, fallback) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const inputRoot = path.resolve(ROOT, readArg('--input-root', '.'))
const outputRoot = path.resolve(ROOT, readArg('--output-root', 'coverage/combined'))

const METRIC_KEYS = ['lines', 'statements', 'functions', 'branches']

const toPosix = (value) => value.split(path.sep).join('/')

const walk = async (dir) => {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }

  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }

    if (entry.name === 'coverage-summary.json') {
      files.push(fullPath)
    }
  }

  return files
}

const summarizeMetric = (items) => {
  const total = items.reduce((sum, item) => sum + (item.total || 0), 0)
  const covered = items.reduce((sum, item) => sum + (item.covered || 0), 0)
  const skipped = items.reduce((sum, item) => sum + (item.skipped || 0), 0)
  const pct = total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2))

  return { total, covered, skipped, pct }
}

const detectSourceName = (filePath) => {
  const normalized = toPosix(filePath).toLowerCase()
  if (normalized.includes('/unit/')) return 'unit'
  if (normalized.includes('/storybook/')) return 'storybook'
  if (normalized.includes('/integration/')) return 'integration'
  return path.basename(path.dirname(filePath))
}

const buildMarkdown = (sources, total) => {
  const lines = []
  lines.push('# Combined Coverage Summary')
  lines.push('')
  lines.push('| Source | Statements | Branches | Functions | Lines |')
  lines.push('| --- | --- | --- | --- | --- |')

  for (const source of sources) {
    const statements = `${source.metrics.statements.pct}% (${source.metrics.statements.covered}/${source.metrics.statements.total})`
    const branches = `${source.metrics.branches.pct}% (${source.metrics.branches.covered}/${source.metrics.branches.total})`
    const functions = `${source.metrics.functions.pct}% (${source.metrics.functions.covered}/${source.metrics.functions.total})`
    const linesMetric = `${source.metrics.lines.pct}% (${source.metrics.lines.covered}/${source.metrics.lines.total})`
    lines.push(`| ${source.name} | ${statements} | ${branches} | ${functions} | ${linesMetric} |`)
  }

  lines.push('| **combined** | ')
  const combinedStatements = `${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`
  const combinedBranches = `${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`
  const combinedFunctions = `${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`
  const combinedLines = `${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`
  lines[lines.length - 1] += `${combinedStatements} | ${combinedBranches} | ${combinedFunctions} | ${combinedLines} |`

  lines.push('')
  return `${lines.join('\n')}\n`
}

const main = async () => {
  const summaryFiles = await walk(inputRoot)

  if (summaryFiles.length === 0) {
    console.log(
      `No coverage-summary.json files found under ${toPosix(path.relative(ROOT, inputRoot))}. Skipping merge.`,
    )
    return
  }

  const sourceSummaries = []

  for (const filePath of summaryFiles) {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const total = parsed.total
    if (!total) continue

    sourceSummaries.push({
      name: detectSourceName(filePath),
      filePath: toPosix(path.relative(ROOT, filePath)),
      metrics: total,
    })
  }

  if (sourceSummaries.length === 0) {
    console.log('Coverage summary files were found, but none contained a total section. Skipping merge.')
    return
  }

  const combinedTotal = {}
  for (const metricKey of METRIC_KEYS) {
    combinedTotal[metricKey] = summarizeMetric(sourceSummaries.map((summary) => summary.metrics[metricKey]))
  }

  const outputPayload = {
    generatedAt: new Date().toISOString(),
    sources: sourceSummaries.map((source) => ({
      name: source.name,
      filePath: source.filePath,
      metrics: source.metrics,
    })),
    total: combinedTotal,
  }

  await fs.mkdir(outputRoot, { recursive: true })

  const summaryJsonPath = path.join(outputRoot, 'coverage-summary.json')
  const summaryMdPath = path.join(outputRoot, 'summary.md')

  await fs.writeFile(summaryJsonPath, `${JSON.stringify(outputPayload, null, 2)}\n`, 'utf8')
  await fs.writeFile(summaryMdPath, buildMarkdown(sourceSummaries, combinedTotal), 'utf8')

  console.log(`Combined coverage summary written to ${toPosix(path.relative(ROOT, summaryJsonPath))}`)
  console.log(`Combined coverage markdown written to ${toPosix(path.relative(ROOT, summaryMdPath))}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
