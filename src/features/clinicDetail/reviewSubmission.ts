export type ClinicReviewFields = {
  doctorId: number
  treatmentId: number
  rating: number
  comment: string
  allowName: boolean
}

export type ClinicReviewSubmissionResult = 'pending' | 'reauthenticate' | 'invalid' | 'failed'

export async function submitClinicReview(
  clinicId: number,
  fields: ClinicReviewFields,
): Promise<ClinicReviewSubmissionResult> {
  try {
    const response = await fetch('/api/reviews?depth=0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic: clinicId,
        doctor: fields.doctorId,
        treatment: fields.treatmentId,
        starRating: fields.rating,
        comment: fields.comment,
        authorVisibility: fields.allowName ? 'firstNameInitial' : 'anonymous',
      }),
    })

    if (response.status === 401 || response.status === 403) return 'reauthenticate'
    if (response.status === 400 || response.status === 409 || response.status === 422) return 'invalid'
    if (!response.ok) return 'failed'

    const result = (await response.json()) as { doc?: { id?: unknown; status?: unknown } }
    return typeof result.doc?.id === 'number' && result.doc.status === 'pending' ? 'pending' : 'failed'
  } catch {
    return 'failed'
  }
}
