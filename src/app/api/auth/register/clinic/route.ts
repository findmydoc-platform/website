import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'

// Public endpoint to submit a clinic application (clinic registration)
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config: configPromise })
  let body: Record<string, unknown> = {}

  try {
    body = await req.json().catch(() => ({}))

    // Dedupe: existing submitted application with same clinicName + email (lightweight, optional)
    const existing = await payload.find({
      collection: 'clinicApplications',
      where: {
        and: [
          { clinicName: { equals: body.clinicName } },
          { contactEmail: { equals: (body.contactEmail as string)?.toLowerCase?.() ?? '' } },
          { status: { equals: 'submitted' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const existingDoc = existing.docs[0]
    if (existingDoc) {
      return NextResponse.json({ success: true, id: existingDoc.id, dedupe: true }, { status: 202 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const userAgent = req.headers.get('user-agent') || ''

    const application = await payload.create({
      collection: 'clinicApplications',
      data: {
        clinicName: body.clinicName as string,
        contactFirstName: body.contactFirstName as string,
        contactLastName: body.contactLastName as string,
        contactEmail: (body.contactEmail as string)?.toLowerCase?.(),
        contactPhone: body.contactPhone as string,
        address: {
          street: body.street as string,
          houseNumber: body.houseNumber as string,
          zipCode: Number(body.zipCode),
          city: body.city as string,
          country: (body.country as string) || 'Turkey',
        },
        additionalNotes: body.additionalNotes as string,
        status: 'submitted',
        sourceMeta: { ip, userAgent },
      },
    })

    payload.logger.info({ msg: 'clinicApplications: submitted', applicationId: application.id })

    return NextResponse.json({ success: true, id: application.id })
  } catch (error: unknown) {
    payload.logger.error(
      { error, clinicName: body?.clinicName, contactEmail: body?.contactEmail },
      'Clinic registration submission failed',
    )
    return NextResponse.json({ error: 'Clinic registration failed' }, { status: 500 })
  }
}
