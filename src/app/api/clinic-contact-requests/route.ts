import configPromise from '@payload-config'
import { NextRequest, NextResponse } from 'next/server'
import { createLocalReq, getPayload } from 'payload'
import type { z } from 'zod'

import { guestInquiryCreateInputSchema } from '@/features/inquiryCommunication/contracts'
import {
  createVerifiedPatientInquiry,
  InquiryCommunicationServiceError,
  submitGuestClinicInquiry,
} from '@/features/inquiryCommunication/service'

const publicValidationMessages = new Set([
  'Consent is required.',
  'Email is invalid.',
  'Full name is required.',
  'Message is required.',
  'Phone number is required.',
  'Select a doctor or treatment.',
])

const firstValidationMessage = (error: z.ZodError): string => {
  const message = error.issues[0]?.message
  return message && publicValidationMessages.has(message) ? message : 'Invalid request payload.'
}

const serializeError = (error: unknown): { message: string; name?: string } =>
  error instanceof Error
    ? { message: error.message, name: error.name }
    : { message: 'Unknown clinic contact request error.' }

const domainErrorResponse = (error: InquiryCommunicationServiceError): Response | null => {
  if (error.kind === 'not-found') {
    return NextResponse.json({ error: 'Clinic not found.' }, { status: 404 })
  }
  if (error.kind === 'invalid-input') {
    const message =
      error.message === 'Doctor is not available for this clinic.' ||
      error.message === 'Treatment is not available for this clinic.'
        ? error.message
        : 'Invalid request payload.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined)
  const parsed = guestInquiryCreateInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstValidationMessage(parsed.error) }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })
  try {
    const req = await createLocalReq({ req: { headers: request.headers } }, payload)
    if (req.user?.collection === 'patients') {
      if (!parsed.data.idempotencyKey) {
        return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 })
      }
      const result = await createVerifiedPatientInquiry(req, {
        clinicId: String(parsed.data.clinicId),
        consent: true,
        ...(parsed.data.doctorId ? { doctorId: String(parsed.data.doctorId) } : {}),
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        idempotencyKey: parsed.data.idempotencyKey,
        message: parsed.data.message,
        phoneNumber: parsed.data.phoneNumber,
        ...(parsed.data.preferredContactWindow ? { preferredContactWindow: parsed.data.preferredContactWindow } : {}),
        ...(parsed.data.treatmentId ? { treatmentId: String(parsed.data.treatmentId) } : {}),
        ...(parsed.data.treatmentTimeline ? { treatmentTimeline: parsed.data.treatmentTimeline } : {}),
      })
      return NextResponse.json({
        success: true,
        id: result.inquiry.id,
        status: 'submitted',
        ...(result.replayed ? { deduped: true } : {}),
      })
    }
    const result = await submitGuestClinicInquiry(req, parsed.data)
    return NextResponse.json({
      success: true,
      id: result.id,
      status: result.status,
      ...(result.deduped ? { deduped: true } : {}),
    })
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) {
      const response = domainErrorResponse(error)
      if (response) return response
    }
    payload.logger.error({ error: serializeError(error) }, 'Patient clinic inquiry submission failed')
    return NextResponse.json({ error: 'Could not submit clinic request.' }, { status: 500 })
  }
}
