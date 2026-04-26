import { describe, expect, it } from 'vitest'
import {
  buildAdminJourneyCoverageMarkdown,
  buildAdminJourneyCoverageReport,
} from '../../../scripts/admin-journey-coverage'

describe('admin journey coverage report', () => {
  it('summarizes collection coverage from journey metadata', () => {
    const report = buildAdminJourneyCoverageReport()
    const treatments = report.collections.find((collection) => collection.collection === 'treatments')

    expect(report.summary.totalJourneys).toBeGreaterThan(0)
    expect(treatments?.journeyIds).toContain('admin.treatments.create')
    expect(treatments?.consumers).toEqual(expect.arrayContaining(['smoke', 'regression', 'capture']))
  })

  it('renders uncovered collections in markdown output', () => {
    const report = buildAdminJourneyCoverageReport()
    const markdown = buildAdminJourneyCoverageMarkdown(report)

    expect(markdown).toContain('# Admin Journey Coverage')
    expect(markdown).toContain('## Uncovered Collections')
    expect(markdown).toContain('| `treatments` |')
    expect(markdown).toContain('`treatments`')
  })
})
