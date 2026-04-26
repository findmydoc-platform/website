'use client'

import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Alert } from '@/components/atoms/alert'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import Link from 'next/link'

interface FormField {
  name: string
  label: string
  type: string
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete']
  placeholder?: string
  required?: boolean
  minLength?: number
  gridCol?: '1' | '2'
}

interface RegistrationFormProps {
  title: string
  description: string
  successMessage?: string
  fields: FormField[]
  submitButtonText: string
  links?: {
    login?: { href: string; text: string }
    home?: { href: string; text: string }
  }
  onSubmit: (data: Record<string, string>) => Promise<void>
  onSuccess?: (data: Record<string, string>) => Promise<void> | void
}

type FieldGroup = { kind: 'single'; field: FormField } | { kind: 'grid'; fields: FormField[] }

export function RegistrationForm({
  title,
  description,
  successMessage = 'Your registration was submitted successfully.',
  fields,
  submitButtonText,
  links,
  onSubmit,
  onSuccess,
}: RegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setHasSubmitted(false)
    setError(null)

    try {
      const formData = new FormData(e.target as HTMLFormElement)
      const data: Record<string, string> = {}

      fields.forEach((field) => {
        data[field.name] = formData.get(field.name) as string
      })

      // Validate password confirmation if both fields exist
      if (data.password && data.confirmPassword && data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const { confirmPassword: _confirmPassword, ...submissionData } = data

      await onSubmit(submissionData)
      await onSuccess?.(submissionData)
      setHasSubmitted(true)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      setError(msg || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const renderField = (field: FormField) => (
    <div key={field.name} className="space-y-2">
      <Label htmlFor={field.name}>{field.label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={field.type}
        placeholder={field.placeholder}
        autoComplete={field.autoComplete}
        required={field.required}
        disabled={isLoading}
        minLength={field.minLength}
      />
    </div>
  )

  // Preserve the authored field order while still grouping adjacent paired fields responsively.
  const fieldGroups = fields.reduce<FieldGroup[]>((groups, field) => {
    if (field.gridCol === '2') {
      const lastGroup = groups.at(-1)

      if (lastGroup?.kind === 'grid') {
        lastGroup.fields.push(field)
        return groups
      }

      groups.push({ kind: 'grid', fields: [field] })
      return groups
    }

    groups.push({ kind: 'single', field })
    return groups
  }, [])

  return (
    <div className="flex items-start justify-center px-0 py-8 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-5">
          <Heading as="h1" align="center" size="h4" className="text-[1.65rem] leading-tight text-balance sm:text-2xl">
            {title}
          </Heading>
          <CardDescription className="text-center leading-6 text-balance">{description}</CardDescription>
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
                {successMessage}
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {fieldGroups.map((group, index) =>
                  group.kind === 'grid' ? (
                    <div key={`grid-group-${index}`} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {group.fields.map(renderField)}
                    </div>
                  ) : (
                    renderField(group.field)
                  ),
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : submitButtonText}
                </Button>
              </form>
            )}

            {links && (
              <div className="space-y-3 text-center [&_a]:break-words [&_p]:leading-5">
                {links.login && (
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href={links.login.href} className="text-primary hover:underline">
                      {links.login.text}
                    </Link>
                  </p>
                )}
                {links.home && (
                  <p className="text-sm text-muted-foreground">
                    <Link href={links.home.href} className="text-primary hover:underline">
                      {links.home.text}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
