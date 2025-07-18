/**
 * Submit form data to PayloadCMS forms API
 * This function transforms the data format to match what BaseRegistrationForm sends
 */
export async function submitFormData({ 
  formId, 
  values 
}: {
  formId: string
  values: Record<string, string>
}) {
  // Transform the flat key-value pairs into Payload's expected format
  const submissionData = Object.entries(values).map(([field, value]) => ({
    field,
    value: String(value),
  }))

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/form-submissions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        form: formId, 
        submissionData 
      }),
    }
  )

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || `Form submission failed: ${res.status}`)
  }

  return res.json()
}
