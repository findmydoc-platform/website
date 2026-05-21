import {
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
  PublicAuthRouteShell,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import {
  ClinicRegistrationForm,
  type ClinicRegistrationCityOption,
} from '@/components/organisms/Auth/ClinicRegistrationForm'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

const getTurkishCityOptions = async (): Promise<ClinicRegistrationCityOption[]> => {
  try {
    const payload = await getPayload({ config: configPromise })
    const countryResult = await payload.find({
      collection: 'countries',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      where: {
        isoCode: {
          equals: 'TR',
        },
      },
    })

    const country = countryResult.docs[0] as { id?: string | number } | undefined
    if (!country?.id) {
      return []
    }

    const cityResult = await payload.find({
      collection: 'cities',
      depth: 0,
      limit: 250,
      overrideAccess: false,
      pagination: false,
      sort: 'name',
      select: {
        id: true,
        name: true,
      },
      where: {
        country: {
          equals: country.id,
        },
      },
    })

    return (cityResult.docs as Array<{ id?: string | number; name?: string | null }>).flatMap((city) => {
      const name = typeof city.name === 'string' ? city.name.trim() : ''
      if (!city.id || name.length === 0) {
        return []
      }

      return [{ id: String(city.id), name }]
    })
  } catch (error) {
    console.warn('Clinic registration city options could not be loaded.', error)
    return []
  }
}

export default async function ClinicRegistrationPage() {
  const cityOptions = await getTurkishCityOptions()

  return (
    <PublicAuthRouteShell>
      <ClinicRegistrationForm containerClassName={PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME} cityOptions={cityOptions} />
    </PublicAuthRouteShell>
  )
}
