import type { SeedType } from './runtime'

const humanizeSeedName = (value: string): string => {
  const normalized = value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase()

  if (!normalized) {
    return 'Seed step'
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export const formatSeedRunTitle = (type: SeedType, reset: boolean): string => {
  const title = type === 'baseline' ? 'Baseline seed' : 'Demo seed'
  return reset ? `${title} with reset` : title
}

export const formatSeedStepTitle = (stepName: string): string => {
  if (stepName === 'globals') return 'Global settings'
  if (stepName === 'reset') return 'Reset collections'
  return humanizeSeedName(stepName)
}

export const formatSeedJobTitle = (stepName: string, chunkIndex?: number, chunkTotal?: number): string => {
  const title = formatSeedStepTitle(stepName)

  if (typeof chunkIndex === 'number' && typeof chunkTotal === 'number' && chunkTotal > 1) {
    return `${title} (${chunkIndex}/${chunkTotal})`
  }

  return title
}

export const formatSeedChangeSummary = (created: number, updated: number): string => {
  return `Added ${created} · Updated ${updated}`
}

const stripSeedRetryPrefix = (value: string): string => {
  return value.replace(/^Retry\s+/i, '').trim()
}

export const formatSeedRetryTitle = (value: string): string => {
  const baseValue = stripSeedRetryPrefix(value)
  return baseValue ? `Retry ${baseValue}` : 'Retry'
}
