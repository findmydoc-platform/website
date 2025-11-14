'use client'

import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FormField {
  name: string
  label: string
  type: string
  placeholder?: string
  required?: boolean
  minLength?: number
  gridCol?: '1' | '2'
}

interface RegistrationFormProps {
  title: string
  description: string
  successRedirect: string
  fields: FormField[]
  submitButtonText: string
  links?: {
    login?: { href: string; text: string }
    home?: { href: string; text: string }
  }
  onSubmit: (data: Record<string, string>) => Promise<void>
}

export function RegistrationForm({
  title,
  description,
  successRedirect,
  fields,
  submitButtonText,
  links,
  onSubmit,
}: RegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
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

      router.push(successRedirect)
    } catch (error: any) {
      console.error('Registration error:', error)
      setError(error.message || 'Registration failed')
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
        required={field.required}
        disabled={isLoading}
        minLength={field.minLength}
      />
    </div>
  )

  const gridFields = fields.filter((f) => f.gridCol === '2')
  const singleFields = fields.filter((f) => f.gridCol !== '2')

  return (
    <div className="flex justify-center items-start px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {error && <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Grid fields (2 columns) */}
              {gridFields.length > 0 && (
                <div className="grid grid-cols-2 gap-4">{gridFields.map(renderField)}</div>
              )}

              {/* Single column fields */}
              {singleFields.map(renderField)}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : submitButtonText}
              </Button>
            </form>

            {links && (
              <div className="text-center space-y-2">
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
