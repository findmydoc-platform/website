import type { ReportingCountMetric, ReportingSourceState } from './contracts'

export const countMetric = (
  source: ReportingCountMetric['source'],
  current: number | null | undefined,
  currentState: ReportingSourceState,
  comparison: number | null | undefined,
  comparisonState: ReportingSourceState,
): ReportingCountMetric => {
  const currentValue = currentState === 'available' && typeof current === 'number' ? current : null
  const comparisonValue = comparisonState === 'available' && typeof comparison === 'number' ? comparison : null
  const absoluteDelta = currentValue !== null && comparisonValue !== null ? currentValue - comparisonValue : null
  return {
    source,
    current: { state: currentState, value: currentValue },
    comparison: {
      state: comparisonState,
      value: comparisonValue,
      absoluteDelta,
      relativeDeltaPercent:
        absoluteDelta !== null && comparisonValue !== null && comparisonValue !== 0
          ? (absoluteDelta / comparisonValue) * 100
          : null,
    },
  }
}
