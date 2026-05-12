import { describe, expect, it } from 'vitest'

import {
  buildSeedJobSummaries,
  formatRetryBatchLabel,
  type SeedJob,
} from '@/components/organisms/DeveloperDashboard/Seeding/seedJobSummaries'
import { formatSeedJobTitle, formatSeedStepTitle } from '@/endpoints/seed/utils/labels'

const createJob = (overrides: Partial<SeedJob> & Pick<SeedJob, 'id' | 'order' | 'stepName'>): SeedJob => {
  return {
    id: overrides.id,
    order: overrides.order,
    status: overrides.status ?? 'queued',
    input: {} as SeedJob['input'],
    queue: overrides.queue ?? 'seed:run-1',
    title:
      overrides.title ??
      formatSeedJobTitle(overrides.stepName, overrides.chunkIndex ?? undefined, overrides.chunkTotal ?? undefined),
    stepName: overrides.stepName,
    kind: overrides.kind ?? 'collection',
    collection: overrides.collection,
    fileName: overrides.fileName,
    chunkIndex: overrides.chunkIndex,
    chunkTotal: overrides.chunkTotal,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    created: overrides.created ?? 0,
    updated: overrides.updated ?? 0,
    warnings: overrides.warnings ?? [],
    failures: overrides.failures ?? [],
    error: overrides.error,
    output: overrides.output,
  }
}

describe('seedJobSummaries', () => {
  it('groups chunked jobs by seed unit and sums visible counts', () => {
    const summaries = buildSeedJobSummaries([
      createJob({
        id: 'cities-1',
        order: 1,
        status: 'succeeded',
        stepName: 'cities',
        collection: 'cities',
        fileName: 'cities',
        chunkIndex: 1,
        chunkTotal: 4,
        created: 2,
        updated: 1,
      }),
      createJob({
        id: 'cities-2',
        order: 2,
        status: 'running',
        stepName: 'cities',
        collection: 'cities',
        fileName: 'cities',
        chunkIndex: 2,
        chunkTotal: 4,
        created: 3,
        updated: 0,
        warnings: ['large chunk'],
      }),
      createJob({
        id: 'settings',
        order: 3,
        status: 'queued',
        stepName: 'globals',
        kind: 'globals',
        fileName: 'globals',
      }),
    ])

    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toMatchObject({
      id: 'batch:collection:cities:cities:cities',
      order: 1,
      title: formatSeedStepTitle('cities'),
      status: 'running',
      created: 5,
      updated: 1,
      warningCount: 1,
      failureCount: 0,
      chunkIndex: 2,
      chunkTotal: 4,
      issueLabels: ['Batch 2/4: 1 warning(s)'],
      isBatchGroup: true,
    })
    expect(summaries[1]).toMatchObject({
      id: 'settings',
      title: formatSeedJobTitle('globals'),
      status: 'queued',
      isBatchGroup: false,
    })
  })

  it('prioritizes failed and cancelled grouped statuses before running progress', () => {
    const summaries = buildSeedJobSummaries([
      createJob({
        id: 'media-1',
        order: 1,
        status: 'succeeded',
        stepName: 'platformContentMedia',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 1,
        chunkTotal: 3,
        created: 1,
      }),
      createJob({
        id: 'media-2',
        order: 2,
        status: 'failed',
        stepName: 'platformContentMedia',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 2,
        chunkTotal: 3,
        updated: 2,
        failures: ['upload failed'],
      }),
      createJob({
        id: 'media-3',
        order: 3,
        status: 'cancelled',
        stepName: 'platformContentMedia',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 3,
        chunkTotal: 3,
      }),
    ])

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      status: 'failed',
      created: 1,
      updated: 2,
      failureCount: 1,
      chunkIndex: 3,
      chunkTotal: 3,
      retryableJobs: [expect.objectContaining({ id: 'media-2' }), expect.objectContaining({ id: 'media-3' })],
      issueLabels: ['Batch 2/3: failed, 1 failure(s)', 'Batch 3/3: cancelled'],
    })
  })

  it('keeps non-chunked jobs separate even when step names match', () => {
    const summaries = buildSeedJobSummaries([
      createJob({
        id: 'treatments-1',
        order: 1,
        stepName: 'treatments',
        collection: 'treatments',
        fileName: 'treatments',
        chunkIndex: 1,
        chunkTotal: 1,
      }),
      createJob({
        id: 'treatments-2',
        order: 2,
        stepName: 'treatments',
        collection: 'treatments',
        fileName: 'treatments',
        chunkIndex: 1,
        chunkTotal: 1,
      }),
    ])

    expect(summaries).toHaveLength(2)
    expect(summaries.map((summary) => summary.id)).toEqual(['treatments-1', 'treatments-2'])
    expect(summaries.every((summary) => !summary.isBatchGroup)).toBe(true)
  })

  it('formats retry labels with compact batch context', () => {
    expect(
      formatRetryBatchLabel(
        createJob({
          id: 'chunk',
          order: 1,
          stepName: 'cities',
          chunkIndex: 2,
          chunkTotal: 4,
        }),
      ),
    ).toBe('2/4')
    expect(formatRetryBatchLabel(createJob({ id: 'single', order: 1, stepName: 'cities' }))).toBe('job')
  })
})
