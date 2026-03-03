export type ToggleDoctorSelectionResult = {
  nextActiveHeroDoctorId: string
  nextSelectedDoctorId: string
  shouldScrollToOurDoctors: boolean
}

export function sanitizeSelectedId(selectedId: string, availableIds: readonly string[]): string {
  if (!selectedId) return ''
  return availableIds.includes(selectedId) ? selectedId : ''
}

export function computeNextVisibleFurtherTreatmentCount(current: number, pageSize: number): number {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0
  const safePageSize = Number.isFinite(pageSize) ? Math.max(1, pageSize) : 1
  return safeCurrent + safePageSize
}

export function resolveDoctorSelectionToggle(
  activeHeroDoctorId: string,
  doctorId: string,
): ToggleDoctorSelectionResult {
  const isCurrentlyActive = activeHeroDoctorId === doctorId
  const nextDoctorId = isCurrentlyActive ? '' : doctorId

  return {
    nextActiveHeroDoctorId: nextDoctorId,
    nextSelectedDoctorId: nextDoctorId,
    shouldScrollToOurDoctors: !isCurrentlyActive,
  }
}

export function buildContactRequestMessage({
  doctorName,
  treatmentName,
}: {
  doctorName?: string
  treatmentName?: string
}): string {
  return `Contact request prepared for ${doctorName ?? 'no doctor selected'} and ${treatmentName ?? 'no treatment selected'}.`
}
