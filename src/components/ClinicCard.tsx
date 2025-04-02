import Link from 'next/link'
import { type Clinic } from '../payload-types'
import Image from 'next/image'

interface ClinicCardProps {
  clinic: Partial<Clinic>
}

export function ClinicCard({ clinic }: ClinicCardProps) {
  return (
    <Link href={`/clinic/${clinic.slug}`} className="block transition-transform hover:scale-105">
      <div className="h-full rounded-lg border border-gray-300 p-4 shadow-sm hover:shadow-md">
        {clinic.thumbnail && (
          <div className="mb-4 overflow-hidden rounded-lg">
            <Image
              src={
                typeof clinic.thumbnail === 'object' && clinic.thumbnail.url
                  ? clinic.thumbnail.url
                  : 'https://picsum.photos/800/400'
              }
              alt={clinic.name ?? 'Clinic thumbnail'}
              width={800}
              height={400}
              className="h-48 w-full object-cover"
            />
          </div>
        )}
        <h3 className="mb-2 text-xl font-semibold">{clinic.name}</h3>
        <p className="text-muted-foreground mb-1">Location: {clinic.city}</p>
        <p className="text-muted-foreground mb-1">Address: {clinic.street}</p>
        <p className="text-muted-foreground">{clinic.contact?.email}</p>
      </div>
    </Link>
  )
}
