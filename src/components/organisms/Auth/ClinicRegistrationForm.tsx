'use client'

import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { submitClinicRegistration } from '@/auth/utilities/registrationSubmissions'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Checkbox } from '@/components/atoms/checkbox'
import { Combobox } from '@/components/atoms/combobox'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { cn } from '@/utilities/ui'

export type ClinicRegistrationCityOption = {
  id: string
  name: string
}

type ClinicRegistrationSubmitHandler = (data: Record<string, string>) => Promise<void>

type ClinicRegistrationFormProps = {
  containerClassName?: string
  cityOptions?: ClinicRegistrationCityOption[]
  onSubmit?: ClinicRegistrationSubmitHandler
}

const websiteOrPublicProfileError = 'Enter a valid website or public profile URL.'

const normalizeWebsiteOrPublicProfile = (value: string): string | null => {
  const trimmedValue = value.trim()

  if (trimmedValue.length === 0) {
    return ''
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`

  try {
    const url = new URL(candidate)

    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

export function ClinicRegistrationForm({
  containerClassName,
  cityOptions = [],
  onSubmit = submitClinicRegistration,
}: ClinicRegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cityError, setCityError] = useState<string | null>(null)
  const [selectedCityId, setSelectedCityId] = useState('')
  const [usesCustomCity, setUsesCustomCity] = useState(cityOptions.length === 0)
  const shouldFocusCityRef = useRef(false)
  const websiteOrPublicProfileRef = useRef<HTMLInputElement>(null)
  const customCityInputRef = useRef<HTMLInputElement>(null)

  const cityComboboxOptions = useMemo(
    () =>
      cityOptions.map((city) => ({
        label: city.name,
        value: city.id,
        keywords: [city.name],
      })),
    [cityOptions],
  )

  const selectedCity = cityOptions.find((city) => city.id === selectedCityId)
  const isCityListAvailable = cityOptions.length > 0
  const cityErrorId = cityError ? 'clinic-city-error' : undefined

  useEffect(() => {
    if (!shouldFocusCityRef.current) {
      return
    }

    shouldFocusCityRef.current = false

    if (usesCustomCity) {
      customCityInputRef.current?.focus()
      return
    }

    document.getElementById('clinic-city')?.focus()
  }, [usesCustomCity])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setHasSubmitted(false)
    setError(null)
    setCityError(null)

    try {
      const formData = new FormData(event.currentTarget)
      const customCity = String(formData.get('city') ?? '').trim()
      const websiteOrPublicProfile = normalizeWebsiteOrPublicProfile(
        String(formData.get('websiteOrPublicProfile') ?? ''),
      )

      if (websiteOrPublicProfile === null) {
        websiteOrPublicProfileRef.current?.focus()
        throw new Error(websiteOrPublicProfileError)
      }

      if (usesCustomCity && customCity.length === 0) {
        const message = 'Enter the clinic city in Turkey.'
        setCityError(message)
        customCityInputRef.current?.focus()
        throw new Error(message)
      }

      if (!usesCustomCity && !selectedCity) {
        const message = 'Select the clinic city or enter it manually.'
        setCityError(message)
        document.getElementById('clinic-city')?.focus()
        throw new Error(message)
      }

      await onSubmit({
        clinicName: String(formData.get('clinicName') ?? ''),
        websiteOrPublicProfile,
        contactFirstName: String(formData.get('contactFirstName') ?? ''),
        contactLastName: String(formData.get('contactLastName') ?? ''),
        street: String(formData.get('street') ?? ''),
        houseNumber: String(formData.get('houseNumber') ?? ''),
        zipCode: String(formData.get('zipCode') ?? ''),
        city: usesCustomCity ? customCity : (selectedCity?.name ?? ''),
        cityId: usesCustomCity ? '' : selectedCityId,
        country: 'Turkey',
        contactPhone: String(formData.get('contactPhone') ?? ''),
        contactEmail: String(formData.get('contactEmail') ?? ''),
      })

      setHasSubmitted(true)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message || 'Clinic registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('flex items-start justify-center px-0 py-8 sm:px-4 sm:py-12', containerClassName)}>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-5">
          <Heading as="h1" align="center" size="h4" className="text-[1.65rem] leading-tight text-balance sm:text-2xl">
            Register Clinic
          </Heading>
          <CardDescription className="text-center leading-6 text-balance">
            Register your clinic. We currently accept clinics located in Turkey only.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-5">
            {error && (
              <Alert variant="error" className="text-left break-words">
                {error}
              </Alert>
            )}
            {hasSubmitted ? (
              <Alert variant="success" className="text-left break-words">
                Thanks, your clinic registration has been submitted. We will review it and get back to you soon.
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Clinic Name</Label>
                  <Input
                    id="clinicName"
                    name="clinicName"
                    type="text"
                    autoComplete="organization"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteOrPublicProfile">Website or public profile</Label>
                  <Input
                    ref={websiteOrPublicProfileRef}
                    id="websiteOrPublicProfile"
                    name="websiteOrPublicProfile"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://example.com"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactFirstName">First Name</Label>
                    <Input
                      id="contactFirstName"
                      name="contactFirstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactLastName">Last Name</Label>
                    <Input
                      id="contactLastName"
                      name="contactLastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street</Label>
                    <Input
                      id="street"
                      name="street"
                      type="text"
                      autoComplete="address-line1"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="houseNumber">House Number</Label>
                    <Input
                      id="houseNumber"
                      name="houseNumber"
                      type="text"
                      autoComplete="address-line2"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Postal Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      type="number"
                      autoComplete="postal-code"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label id="clinic-city-label" htmlFor="clinic-city">
                      City
                    </Label>
                    {usesCustomCity ? (
                      <Input
                        ref={customCityInputRef}
                        id="clinic-city"
                        name="city"
                        type="text"
                        autoComplete="address-level2"
                        required
                        aria-invalid={Boolean(cityError)}
                        aria-describedby={cityErrorId}
                        disabled={isLoading}
                        onChange={() => {
                          setCityError(null)
                        }}
                      />
                    ) : (
                      <>
                        <Combobox
                          id="clinic-city"
                          ariaLabelledBy="clinic-city-label"
                          ariaDescribedBy={cityErrorId}
                          ariaInvalid={Boolean(cityError)}
                          searchAriaLabel="Search cities"
                          options={cityComboboxOptions}
                          value={selectedCityId}
                          onValueChange={(value) => {
                            setSelectedCityId(value)
                            setCityError(null)
                          }}
                          placeholder="Select city"
                          searchPlaceholder="Search city..."
                          emptyLabel="No city found."
                          disabled={isLoading || !isCityListAvailable}
                        />
                        <input type="hidden" name="cityId" value={selectedCityId} />
                        <input type="hidden" name="city" value={selectedCity?.name ?? ''} />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-sm border border-border bg-muted/30 p-3">
                  <Checkbox
                    id="useCustomCity"
                    checked={usesCustomCity}
                    disabled={isLoading || !isCityListAvailable}
                    onCheckedChange={(checked) => {
                      const nextUsesCustomCity = checked === true
                      shouldFocusCityRef.current = true
                      setCityError(null)
                      setUsesCustomCity(nextUsesCustomCity)
                      if (nextUsesCustomCity) {
                        setSelectedCityId('')
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="useCustomCity" className="cursor-pointer text-sm leading-5">
                      My city is not listed
                    </Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Enter another Turkish city or province name if it is not available in the list.
                    </p>
                  </div>
                </div>
                {cityError ? (
                  <p id="clinic-city-error" className="-mt-2 text-sm leading-5 text-error">
                    {cityError}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <span id="country-label" className="inline-block text-sm leading-none font-medium">
                    Country
                  </span>
                  <div
                    id="country-display"
                    aria-labelledby="country-label"
                    aria-describedby="country-policy"
                    className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-4 py-2 text-base text-foreground md:text-sm"
                  >
                    Turkey
                  </div>
                  <input type="hidden" name="country" value="Turkey" />
                  <p id="country-policy" className="text-xs leading-5 text-muted-foreground">
                    Clinic registrations are currently limited to Turkey.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Phone Number</Label>
                  <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" disabled={isLoading} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isLoading}
                  />
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  By submitting, you confirm that you have read our{' '}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  . We use your details to review this clinic registration.
                </p>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Submitting...' : 'Submit Registration'}
                </Button>
              </form>
            )}

            <div className="space-y-3 text-center [&_a]:break-words [&_p]:leading-5">
              <p className="text-sm text-muted-foreground">
                <Link href="/" className="text-primary hover:underline">
                  Back to home
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
