import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import React from 'react'
import { Doctor } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const clinics = await payload.find({
    collection: 'clinics',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = clinics.docs.map((doc) => ({
    slug: doc.slug,
  }))

  return params
}

type Args = {
  params: Promise<{
    name?: string
    slug?: string
  }>
}

export default async function ClinicPage({ params: paramsPromise }: Args) {
  const slug = decodeURIComponent((await paramsPromise).slug || '')
  const payload = await getPayload({ config: configPromise })

  const clinics = await payload.find({
    collection: 'clinics',
    limit: 1,
    pagination: false,
    where: {
      slug: {
        equals: slug,
      },
    },
    depth: 1,
  })

  const clinic = clinics.docs[0] || null

  if (!clinic) {
    notFound()
  }

  const doctors = await payload.find({
    collection: 'doctors',
    limit: 10,
    pagination: false,
    where: {
      clinic: {
        equals: clinic.id,
      },
    },
    depth: 1,
  })

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          {clinic.thumbnail && typeof clinic.thumbnail !== 'number' && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <Image
                src={clinic.thumbnail.url || 'https://picsum.photos/800/256'}
                alt={clinic.name}
                width={800}
                height={256}
                className="w-full h-64 object-cover"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-4">{clinic.name}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Contact</h2>
              <div className="space-y-2">
                <p>Email: {clinic.contact.email}</p>
                <p>Phone: {clinic.contact.phoneNumber}</p>
                {clinic.contact.website && (
                  <p>
                    Website:{' '}
                    <a
                      href={clinic.contact.website}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {clinic.contact.website}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Location Information */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Location</h2>
              <div className="space-y-2">
                <p>{clinic.address.street}</p>
                <p>
                  {typeof clinic.address.city !== 'number'
                    ? clinic.address.city.name
                    : clinic.address.city}
                  , {clinic.address.country}
                </p>
                <p>Postal Code: {clinic.address.zipCode}</p>
                <p>Street: {clinic.address.street}</p>
                <p>Phone: {clinic.contact.phoneNumber}</p>
                <p>Email: {clinic.contact.email}</p>
                {clinic.contact.website && (
                  <p>
                    Website:{' '}
                    <a
                      href={clinic.contact.website}
                      className="text-blue-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {clinic.contact.website}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Doctors Section */}
          {doctors && doctors.docs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Our Doctors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.docs.map((doctor: Doctor) => (
                  <div key={doctor.id} className="p-6 border rounded-lg shadow-sm">
                    {doctor.profileImage && (
                      <Image
                        src={getMediaUrl(doctor.profileImage)!}
                        alt={doctor.fullName}
                        width={128}
                        height={128}
                        className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
                      />
                    )}
                    <h3 className="text-xl font-semibold text-center">{doctor.fullName}</h3>
                    <p className="text-center text-gray-600">{doctor.qualifications}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
