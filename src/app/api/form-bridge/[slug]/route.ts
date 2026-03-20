import { getForm } from '@/utilities/getForm'
import { getServerLogger } from '@/utilities/logging/serverLogger'
import { createScopedLogger, getRequestLogContext, toLoggedError } from '@/utilities/logging/shared'
import { FormSubmissionError, submitFormData } from '@/utilities/submitForm'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Slug-based bridge for marketing/contact forms.
 * Uses a non-conflicting API namespace so Payload's native /api/forms/:id routes remain untouched.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const logger = createScopedLogger(await getServerLogger(), {
    scope: 'api.formBridge',
    ...getRequestLogContext({ headers: request.headers, request }),
  })

  try {
    const { slug } = await params
    const formData = await request.json()
    const isObjectPayload = typeof formData === 'object' && formData !== null && !Array.isArray(formData)

    if (!isObjectPayload) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const form = await getForm(slug)

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const result = await submitFormData({
      formId: String(form.id),
      values: formData,
    })

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      data: result,
    })
  } catch (error: unknown) {
    logger.error(
      {
        err: toLoggedError(error),
        event: 'api.formBridge.submit.failed',
      },
      'Form submission failed',
    )
    const msg = error instanceof Error ? error.message : String(error)
    const status = error instanceof FormSubmissionError ? error.status : 500
    return NextResponse.json({ error: msg || 'Form submission failed' }, { status })
  }
}
