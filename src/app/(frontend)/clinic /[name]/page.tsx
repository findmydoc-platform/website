import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { notFound } from 'next/navigation'
import Image from 'next/image'

export default async function ClinicPage({ params }: { params: { name: string } }) {
  const payload = await getPayload({ config: configPromise })

  const clinics = await payload.find({
    collection: 'clinics',
    where: {
      name: {
        equals: decodeURIComponent(params.name),
      },
    },
    depth: 2,
  })

  if (!clinics.docs[0]) {
    notFound()
  }

  const clinic = clinics.docs[0]

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          {clinic.thumbnail && typeof clinic.thumbnail !== 'number' && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <Image
                src={clinic.thumbnail.url}
                alt={clinic.name}
                width={800} // Replace with actual width
                height={256} // Replace with actual height
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
                <p>Phone: {clinic.contact.phone}</p>
                {clinic.contact.website && (
                  <p>
                    Website:{' '}
                    <a href={clinic.contact.website} className="text-blue-600 hover:underline">
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
                <p>{clinic.street}</p>
                <p>{clinic.zipCode}</p>
                <p>
                  {clinic.city}, {clinic.country}
                </p>
              </div>
            </div>
          </div>

          {/* Doctors Section */}
          {clinic.assignedDoctors && clinic.assignedDoctors.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-semibold mb-6">Our Doctors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clinic.assignedDoctors.map((doctor: any) => (
                  <div key={doctor.id} className="p-6 border rounded-lg shadow-sm">
                    {doctor.image && (
                      <Image
                        src={doctor.image.url}
                        alt={doctor.name}
                        width={128} // Replace with actual width
                        height={128} // Replace with actual height
                        className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
                      />
                    )}
                    <h3 className="text-xl font-semibold text-center">{doctor.name}</h3>
                    <p className="text-center text-gray-600">{doctor.specialization}</p>
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
