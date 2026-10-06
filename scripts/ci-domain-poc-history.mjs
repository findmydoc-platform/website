import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { inventoryGroups, runtimeGraph, groups, selectGroups } from './ci-domain-poc.mjs'
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }))
const output = process.argv[2]
if (!output) throw new Error('Output directory is required.')
fs.mkdirSync(output, { recursive: true })
const inventory = inventoryGroups()
const manifests = Object.fromEntries(
  Object.entries(inventory.groups).map(([name, value]) => [
    name,
    {
      ...value,
      dependencies: [
        ...new Set([
          ...value.dependencies,
          ...runtimeGraph(
            groups[name].files.map((file) => `tests/integration-domain-poc/${name}/${file}`),
            process.cwd(),
            true,
          ).files,
        ]),
      ],
    },
  ]),
)
const prs = gh(['pr', 'list', '--state', 'merged', '--limit', '100', '--json', 'number,mergedAt,author'])
  .filter((pr) => !pr.author.is_bot && !pr.author.login.endsWith('[bot]'))
  .sort((a, b) => b.mergedAt.localeCompare(a.mergedAt))
  .slice(0, 50)
const samples = []
for (const pr of prs) {
  const pages = gh([
    'api',
    '--paginate',
    '--slurp',
    `repos/findmydoc-platform/website/pulls/${pr.number}/files?per_page=100`,
  ])
  const files = pages.flat()
  const selection =
    files.length >= 3000
      ? { groups: Object.keys(groups), reasons: ['github-diff-limit'], fallback: true }
      : selectGroups(
          files.map((file) => ({ path: file.filename, previousPath: file.previous_filename, status: file.status })),
          manifests,
        )
  samples.push({
    number: pr.number,
    mergedAt: pr.mergedAt,
    changedPaths: files.map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename,
      status: file.status,
    })),
    selection,
  })
}
const report = {
  sampledPRs: samples.length,
  currentDependencyGraph: true,
  historicalRuntimeNotReplayed: true,
  selectionCounts: Object.fromEntries(
    [0, 1, 2].map((count) => [count, samples.filter((sample) => sample.selection.groups.length === count).length]),
  ),
  fallbacks: samples.filter((sample) => sample.selection.fallback).length,
  samples,
}
fs.writeFileSync(path.join(output, 'history.json'), JSON.stringify(report, null, 2))
console.log(
  JSON.stringify({
    sampledPRs: report.sampledPRs,
    selectionCounts: report.selectionCounts,
    fallbacks: report.fallbacks,
  }),
)
