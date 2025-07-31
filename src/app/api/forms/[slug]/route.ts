import { getForm } from '@/utilities/getForm'
import { submitFormData } from '@/utilities/submitForm'
import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Custom API route to bridge BaseRegistrationForm with PayloadCMS forms
 * This allows us to use BaseRegistrationForm as-is without modification
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  let payload;
  
  try {
    payload = await getPayload({ config: configPromise })
    const { slug } = await params
    const formData = await request.json()

    payload.logger.info(`Form submission request received for slug: ${slug}`)

    // Get form configuration from Payload
    const form = await getForm(slug)

    if (!form) {
      payload.logger.warn(`Form submission failed - form not found: ${slug}`)
      return NextResponse.json({ 
        error: 'The requested form could not be found. Please check that the form exists or contact support if this problem persists.' 
      }, { status: 404 })
    }

    payload.logger.info(`Processing form submission for: ${form.title} (ID: ${form.id})`)

    // Submit to Payload forms API
    const result = await submitFormData({
      formId: String(form.id),
      values: formData,
    })

    payload.logger.info(`Form submission successful for ${form.title}, submission ID: ${result.id}`)

    return NextResponse.json({
      success: true,
      message: 'Form submitted successfully',
      data: result,
    })
  } catch (error: any) {
    const errorMessage = error.message || 'Form submission failed'
    
    if (payload) {
      payload.logger.error('Form submission error:', {
        error: errorMessage,
        stack: error.stack,
        slug: (await params).slug,
      })
    } else {
      console.error('Form submission error (payload not initialized):', error)
    }
    
    // Provide user-friendly error messages based on error type
    let userMessage = 'An unexpected error occurred while submitting the form. Please try again.'
    
    if (errorMessage.includes('Unable to retrieve form')) {
      userMessage = 'The form could not be loaded. Please refresh the page and try again. If the problem persists, contact support.'
    } else if (errorMessage.includes('validation')) {
      userMessage = 'Please check your form data and ensure all required fields are filled correctly.'
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      userMessage = 'Network error occurred. Please check your connection and try again.'
    }
    
    return NextResponse.json({ 
      error: userMessage 
    }, { status: 500 })
  }
}
