import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { comparePair, distribution } from '../../../scripts/ci-domain-poc-summary.mjs'
import { groups, runtimeGraph, selectGroups, validateMeasurement } from '../../../scripts/ci-domain-poc.mjs'

const manifests = {
  location: { dependencies: ['src/collections/Countries.ts', 'src/access/shared.ts'], unresolved: [] },
  gallery: { dependencies: ['src/gallery.ts', 'src/access/shared.ts'], unresolved: [] },
}
const validReceipt = () => ({
  status: 'passed',
  cleanup: 'passed',
  groups: [
    {
      name: 'location',
      report: {
        unhandledErrors: 0,
        modules: [
          {
            filename: 'tests/integration-domain-poc/location/countries.lifecycle.test.ts',
            tests: Array.from({ length: 5 }, (_, i) => ({ name: `case ${i}`, state: 'passed', retries: 0 })),
          },
        ],
      },
    },
  ],
})
describe('domain POC selection and evidence', () => {
  it.each([
    [['src/collections/Countries.ts'], ['location']],
    [['src/gallery.ts'], ['gallery']],
    [['src/access/shared.ts'], ['location', 'gallery']],
    [['docs/guide.md'], []],
    [[{ path: 'src/gallery.ts', previousPath: 'src/collections/Countries.ts' }], ['location', 'gallery']],
    [[{ path: 'src/gallery.ts', status: 'removed' }], ['gallery']],
    [['src/unknown.ts'], ['location', 'gallery']],
    [['pnpm-lock.yaml'], ['location', 'gallery']],
  ])('selects conservatively for %j', (changes, expected) => {
    expect(selectGroups(changes, manifests).groups).toEqual(expected)
  })
  it('falls back on failed classification, malformed changes and unresolved imports', () => {
    expect(selectGroups([], manifests, [], true).fallback).toBe(true)
    expect(selectGroups([{}], manifests).fallback).toBe(true)
    expect(selectGroups(['../secret'], manifests).fallback).toBe(true)
    expect(
      selectGroups(['src/gallery.ts'], { ...manifests, gallery: { ...manifests.gallery, unresolved: ['computed'] } })
        .fallback,
    ).toBe(true)
  })
  it('adds Vitest-discovered affected files', () => {
    const file = `tests/integration-domain-poc/gallery/${groups.gallery.files[0]}`
    expect(selectGroups(['src/collections/Countries.ts'], manifests, [file]).groups).toEqual(['location', 'gallery'])
  })
  it('rejects failed, skipped, retried, cancelled and incomplete evidence', () => {
    expect(validateMeasurement(validReceipt())).toBeTruthy()
    for (const state of ['failed', 'skipped', 'pending']) {
      const receipt = validReceipt()
      receipt.groups[0]!.report.modules[0]!.tests[0]!.state = state
      expect(() => validateMeasurement(receipt)).toThrow()
    }
    const retry = validReceipt()
    retry.groups[0]!.report.modules[0]!.tests[0]!.retries = 1
    expect(() => validateMeasurement(retry)).toThrow()
    for (const status of ['failed', 'cancelled', 'incomplete'])
      expect(() => validateMeasurement({ ...validReceipt(), status })).toThrow()
    expect(() => validateMeasurement({ ...validReceipt(), cleanup: 'failed' })).toThrow()
    expect(() => validateMeasurement({ ...validReceipt(), groups: [] })).toThrow()
  })
  it('preserves the original test bodies and assertions', () => {
    const canonical = (filename: string) => {
      const original = ts.createSourceFile(filename, readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
      const transformed = ts.transform(original, [
        (context) => {
          const visitor: ts.Visitor = (node) => {
            if (ts.isImportDeclaration(node)) return undefined
            if (
              ts.isCallExpression(node) &&
              ts.isIdentifier(node.expression) &&
              node.expression.text === 'measurePhase'
            ) {
              const callback = node.arguments[2]
              if (!callback || !ts.isArrowFunction(callback) || !ts.isExpression(callback.body))
                throw new Error('Unexpected instrumentation.')
              return ts.visitNode(callback.body, visitor)
            }
            return ts.visitEachChild(node, visitor, context)
          }
          return (node) => ts.visitNode(node, visitor) as ts.SourceFile
        },
      ])
      try {
        return ts.createPrinter().printFile(transformed.transformed[0]!)
      } finally {
        transformed.dispose()
      }
    }
    for (const [group, entry] of Object.entries(groups))
      for (const file of entry.files) {
        expect(canonical(`tests/integration-domain-poc/${group}/${file}`)).toBe(canonical(`tests/integration/${file}`))
      }
  })
  it('rejects changed case identity, sources and coverage during comparison', () => {
    const a = {
      ...validReceipt(),
      variant: 'baseline',
      experiment: 'config',
      commit: 'fixed',
      node: '24',
      pnpm: '10',
      group: 'location',
      scenario: 'country',
      round: 1,
      durationMs: 100,
    }
    const b = { ...structuredClone(a), variant: 'candidate', durationMs: 70 }
    const coverage = {
      location: {
        total: Object.fromEntries(
          ['lines', 'branches', 'functions', 'statements'].map((key) => [key, { total: 10, covered: 8 }]),
        ),
      },
    }
    expect(comparePair(a, b, coverage, coverage).durationSavingMs).toBe(30)
    expect(() => comparePair(a, { ...b, commit: 'different' }, coverage, coverage)).toThrow()
    const changed = structuredClone(b)
    changed.groups[0]!.report.modules[0]!.tests[0]!.name = 'different case'
    expect(() => comparePair(a, changed, coverage, coverage)).toThrow()
    expect(() => comparePair(a, b, coverage, {})).toThrow()
    expect(distribution([10, -2]).median).toBe(4)
  })
  it('follows runtime imports but excludes type-only imports and handles config boundaries', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'domain-poc-'))
    try {
      mkdirSync(path.join(root, 'src'))
      writeFileSync(
        path.join(root, 'src/root.ts'),
        "import type { X } from './missing'; import './child'; export { x } from './child'; import('@payload-config'); import(variable)",
      )
      writeFileSync(path.join(root, 'src/child.ts'), 'export const x = 1')
      writeFileSync(path.join(root, 'src/payload.config.ts'), 'export default {}')
      const graph = runtimeGraph(['src/root.ts'], root, true)
      expect(graph.files).toEqual(['src/child.ts', 'src/root.ts'])
      expect(graph.unresolved).toEqual(['src/root.ts:computed-import'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
