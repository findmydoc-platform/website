import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { ClinicCard } from '@/components/ClinicCard'

export default async function Home() {
  const payload = await getPayload({ config: configPromise })

  const clinics = await payload.find({
    collection: 'clinics',
    depth: 1,
    limit: 12,
    overrideAccess: false,
    select: {
      name: true,
      city: true,
      street: true,
      contact: true,
      thumbnail: true,
    },
  })

  return (
    <main className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <div className="mb-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">Find my Doc</h1>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
          Find your doctor fast and easy :)
        </p>
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search for clinics..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.docs.map((clinic) => (
            <ClinicCard key={clinic.id} clinic={clinic} />
          ))}
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="mt-16 text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Create an account on findmydoc and start your clinic search journey.
        </p>
      </div>
    </main>
  )
}

export { generateMetadata } from './[slug]/page'
