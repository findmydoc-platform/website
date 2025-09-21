/**
 * Submit form data to PayloadCMS forms API.
 * Transforms flat key-value pairs into Payload's expected submission format.
 *
 * @param params - Form submission parameters
 * @param params.formId - ID of the form to submit to
 * @param params.values - Form field values as key-value pairs
 * @returns API response from form submission
 * @throws Error if submission fails
 *
 * @example
 * await submitFormData({
 *   formId: 'contact-form-id',
 *   values: { name: 'John Doe', email: 'john@example.com' }
 * })
 */
export async function submitFormData({ formId, values }: { formId: string; values: Record<string, unknown> }) {
  // Transform the flat key-value pairs into Payload's expected format
  const submissionData = Object.entries(values).map(([field, value]) => ({
    field,
    value: String(value),
  }))

  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/form-submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form: formId,
      submissionData,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Form submission failed: ${res.status}`)
  }

  return res.json()
}
