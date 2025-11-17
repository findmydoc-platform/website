import { getForm } from '@/utilities/getForm'
import { submitFormData } from '@/utilities/submitForm'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Custom API route to bridge the shared RegistrationForm with PayloadCMS forms
 * This allows us to reuse RegistrationForm without modifying Payload's default handlers
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const formData = await request.json()

    // Get form configuration from Payload
    const form = await getForm(slug)

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    // Submit to Payload forms API
    const result = await submitFormData({
      formId: form.id,
      values: formData,
    })

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Form submission error:', error)
    return NextResponse.json({ error: error.message || 'Form submission failed' }, { status: 500 })
  }
}
