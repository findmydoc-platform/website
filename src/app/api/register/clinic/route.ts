import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@/payload.config'
import { getPayload } from 'payload'

// Public endpoint to submit a clinic application (clinic registration)
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const body = await req.json().catch(() => ({}))

    // Dedupe: existing submitted application with same clinicName + email (lightweight, optional)
    const existing = await payload.find({
      collection: 'clinicApplications',
      where: {
        and: [
          { clinicName: { equals: body.clinicName } },
          { contactEmail: { equals: body.contactEmail?.toLowerCase?.() ?? '' } },
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
        clinicName: body.clinicName,
        contactFirstName: body.contactFirstName,
        contactLastName: body.contactLastName,
        contactEmail: body.contactEmail?.toLowerCase?.(),
        contactPhone: body.contactPhone,
        address: {
          street: body.street,
          houseNumber: body.houseNumber,
          zipCode: Number(body.zipCode),
          city: body.city,
          country: body.country || 'Turkey',
        },
        additionalNotes: body.additionalNotes,
        status: 'submitted',
        sourceMeta: { ip, userAgent },
      },
    })

    payload.logger.info({ msg: 'clinicApplications: submitted', applicationId: application.id })

    return NextResponse.json({ success: true, id: application.id })
  } catch (error: any) {
    console.error('Clinic registration error', error)
    return NextResponse.json({ error: 'Clinic registration failed' }, { status: 500 })
  }
}
