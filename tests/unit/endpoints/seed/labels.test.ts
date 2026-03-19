import { describe, expect, it } from 'vitest'
import {
  formatSeedChangeSummary,
  formatSeedJobTitle,
  formatSeedRetryTitle,
  formatSeedRunTitle,
  formatSeedStepTitle,
} from '@/endpoints/seed/utils/labels'

describe('seed labels', () => {
  it('formats run titles for baseline and demo seeds', () => {
    expect(formatSeedRunTitle('baseline', false)).toBe('Baseline seed')
    expect(formatSeedRunTitle('baseline', true)).toBe('Baseline seed with reset')
    expect(formatSeedRunTitle('demo', false)).toBe('Demo seed')
    expect(formatSeedRunTitle('demo', true)).toBe('Demo seed with reset')
  })

  it('formats readable step and job titles', () => {
    expect(formatSeedStepTitle('globals')).toBe('Global settings')
    expect(formatSeedStepTitle('reset')).toBe('Reset collections')
    expect(formatSeedStepTitle('platform-content-media')).toBe('Platform content media')
    expect(formatSeedJobTitle('platform-content-media', 1, 6)).toBe('Platform content media (1/6)')
    expect(formatSeedJobTitle('platform-content-media')).toBe('Platform content media')
  })

  it('formats created and updated counts in plain language', () => {
    expect(formatSeedChangeSummary(0, 2)).toBe('Added 0 · Updated 2')
  })

  it('keeps retry titles readable without stacking prefixes', () => {
    expect(formatSeedRetryTitle('Baseline seed')).toBe('Retry Baseline seed')
    expect(formatSeedRetryTitle('Retry Baseline seed')).toBe('Retry Baseline seed')
  })
})
