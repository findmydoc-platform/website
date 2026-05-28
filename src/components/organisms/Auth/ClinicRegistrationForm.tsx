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
import { Field, FieldError } from '@/components/atoms/field'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
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

type ClinicInputFieldConfig = {
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete']
  disabled?: boolean
  id: string
  label: string
  name: string
  placeholder?: string
  required?: boolean
  type: React.HTMLInputTypeAttribute
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
  const formValidation = usePublicFormValidation({
    messages: {
      city: { valueMissing: 'Enter the clinic city in Turkey.' },
      contactEmail: { typeMismatch: 'Enter a valid email address.' },
      websiteOrPublicProfile: { valueMissing: 'Enter a website or public profile URL.' },
    },
  })

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
  const cityErrorId =
    cityError || formValidation.getFieldError('city') ? formValidation.getFieldErrorId('city') : undefined

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
    setHasSubmitted(false)
    setError(null)
    setCityError(null)

    const form = event.currentTarget
    if (!formValidation.validateForm(form)) return

    try {
      const formData = new FormData(form)
      const customCity = String(formData.get('city') ?? '').trim()
      const websiteOrPublicProfile = normalizeWebsiteOrPublicProfile(
        String(formData.get('websiteOrPublicProfile') ?? ''),
      )

      if (websiteOrPublicProfile === null) {
        formValidation.setCustomFieldError('websiteOrPublicProfile', websiteOrPublicProfileError)
        websiteOrPublicProfileRef.current?.focus()
        return
      }

      if (usesCustomCity && customCity.length === 0) {
        const message = 'Enter the clinic city in Turkey.'
        setCityError(message)
        customCityInputRef.current?.focus()
        return
      }

      if (!usesCustomCity && !selectedCity) {
        const message = 'Select the clinic city or enter it manually.'
        setCityError(message)
        document.getElementById('clinic-city')?.focus()
        return
      }

      setIsLoading(true)

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
      formValidation.clearAllFieldErrors()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setError(message || 'Clinic registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const renderInputField = ({
    autoComplete,
    disabled = isLoading,
    id,
    label,
    name,
    placeholder,
    required,
    type,
  }: ClinicInputFieldConfig) => {
    const fieldError = formValidation.getFieldError(name)
    const fieldErrorId = formValidation.getFieldErrorId(name)

    return (
      <Field data-invalid={fieldError ? true : undefined}>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onChange={formValidation.handleFieldChange}
          {...formValidation.getFieldProps(name)}
        />
        <FieldError id={fieldErrorId}>{fieldError}</FieldError>
      </Field>
    )
  }

  const websiteOrPublicProfileErrorMessage = formValidation.getFieldError('websiteOrPublicProfile')

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
              <form onSubmit={handleSubmit} onInvalid={formValidation.handleInvalid} className="space-y-4" noValidate>
                {renderInputField({
                  id: 'clinicName',
                  name: 'clinicName',
                  label: 'Clinic Name',
                  type: 'text',
                  autoComplete: 'organization',
                  required: true,
                })}

                <Field data-invalid={websiteOrPublicProfileErrorMessage ? true : undefined}>
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
                    onChange={formValidation.handleFieldChange}
                    {...formValidation.getFieldProps('websiteOrPublicProfile')}
                  />
                  <FieldError id={formValidation.getFieldErrorId('websiteOrPublicProfile')}>
                    {websiteOrPublicProfileErrorMessage}
                  </FieldError>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {renderInputField({
                    id: 'contactFirstName',
                    name: 'contactFirstName',
                    label: 'First Name',
                    type: 'text',
                    autoComplete: 'given-name',
                    required: true,
                  })}
                  {renderInputField({
                    id: 'contactLastName',
                    name: 'contactLastName',
                    label: 'Last Name',
                    type: 'text',
                    autoComplete: 'family-name',
                    required: true,
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {renderInputField({
                    id: 'street',
                    name: 'street',
                    label: 'Street',
                    type: 'text',
                    autoComplete: 'address-line1',
                    required: true,
                  })}
                  {renderInputField({
                    id: 'houseNumber',
                    name: 'houseNumber',
                    label: 'House Number',
                    type: 'text',
                    autoComplete: 'address-line2',
                    required: true,
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {renderInputField({
                    id: 'zipCode',
                    name: 'zipCode',
                    label: 'Postal Code',
                    type: 'number',
                    autoComplete: 'postal-code',
                    required: true,
                  })}
                  <Field data-invalid={cityError || formValidation.getFieldError('city') ? true : undefined}>
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
                        aria-invalid={Boolean(cityError || formValidation.getFieldError('city'))}
                        aria-describedby={
                          cityError || formValidation.getFieldError('city')
                            ? formValidation.getFieldErrorId('city')
                            : undefined
                        }
                        disabled={isLoading}
                        onChange={(inputEvent) => {
                          formValidation.handleFieldChange(inputEvent)
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
                            formValidation.clearFieldError('city')
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
                    <FieldError id={formValidation.getFieldErrorId('city')}>
                      {cityError ?? formValidation.getFieldError('city')}
                    </FieldError>
                  </Field>
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
                      formValidation.clearFieldError('city')
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

                {renderInputField({
                  id: 'contactPhone',
                  name: 'contactPhone',
                  label: 'Phone Number',
                  type: 'tel',
                  autoComplete: 'tel',
                })}

                {renderInputField({
                  id: 'contactEmail',
                  name: 'contactEmail',
                  label: 'Email',
                  type: 'email',
                  autoComplete: 'email',
                  required: true,
                })}

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
