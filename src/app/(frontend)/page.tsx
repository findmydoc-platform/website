import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
        <div className="flex justify-center gap-8">
          <Button asChild>
            <Link href="/admin">
              Open Admin <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="https://payloadcms.com/docs" target="_blank">
              Documentation
            </Link>
          </Button>
        </div>
      </div>

      {/* Getting Started Section */}
      <div className="mt-16 text-center">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Create an account on FMD and start your clinic search journey.
        </p>
        <pre className="bg-muted inline-block rounded-lg p-4 text-left">
          <code>npx degit LearnPayload/payload-blank-template my-project</code>
        </pre>
      </div>
    </main>
  )
}

// We can keep the generateMetadata export if needed
export { generateMetadata } from './[slug]/page'
