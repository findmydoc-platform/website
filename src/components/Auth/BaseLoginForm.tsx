'use client'

import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { handleLogin } from '@/auth/utilities/loginHandler'
import { UserType, LoginState, LoginResponse, LoginError } from '@/components/Auth/types/loginTypes'
import { cn } from '@/utilities/ui'

type StatusVariant = 'success' | 'info' | 'warning'

const STATUS_VARIANT_STYLES: Record<StatusVariant, string> = {
  success: 'intent-success text-intent-success',
  info: 'border-primary/30 bg-primary/10 text-primary',
  warning: 'intent-warning text-intent-warning',
}

interface BaseLoginFormProps {
  title: string
  description: string
  userTypes: UserType[] | UserType // Support both single and multiple user types
  redirectPath?: string
  emailPlaceholder?: string
  links?: {
    register?: { href: string; text: string }
    home?: { href: string; text: string }
  }
  statusMessage?: {
    text: string
    variant?: StatusVariant
  }
}

export function BaseLoginForm({
  title,
  description,
  userTypes,
  redirectPath,
  emailPlaceholder = 'name@example.com',
  links,
  statusMessage,
}: BaseLoginFormProps) {
  const [state, setState] = useState<LoginState>({
    isLoading: false,
    error: null,
    fieldErrors: {},
  })
  const router = useRouter()

  // Normalize userTypes to always be an array
  const allowedUserTypes = Array.isArray(userTypes) ? userTypes : [userTypes]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset state and start loading
    setState((prev) => ({ ...prev, error: null, fieldErrors: {}, isLoading: true }))

    const formData = new FormData(e.target as HTMLFormElement)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await handleLogin({ email, password, allowedUserTypes })

      if ('error' in result) {
        const errorResult = result as LoginError

        // Handle field-specific errors
        if (errorResult.details && errorResult.details.length > 0) {
          const newFieldErrors: Record<string, string> = {}
          errorResult.details.forEach((detail) => {
            newFieldErrors[detail.field] = detail.message
          })
          setState((prev) => ({
            ...prev,
            fieldErrors: newFieldErrors,
            error: null,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            error: errorResult.message || errorResult.error || 'An unexpected error occurred. Please try again.',
          }))
        }
        return
      }

      const successResult = result as LoginResponse
      const finalRedirectPath = redirectPath || successResult.redirectUrl
      router.push(finalRedirectPath)
      router.refresh()
    } catch (error: any) {
      console.error('Login error:', error)
      setState((prev) => ({
        ...prev,
        error: 'An unexpected error occurred. Please try again.',
      }))
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }

  return (
    <div className="flex items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {statusMessage && (
              <div
                className={cn(
                  'rounded-md border px-3 py-2 text-sm',
                  STATUS_VARIANT_STYLES[statusMessage.variant ?? 'info'],
                )}
              >
                {statusMessage.text}
              </div>
            )}
            {state.error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">{state.error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={emailPlaceholder}
                  required
                  disabled={state.isLoading}
                  className={state.fieldErrors.email ? 'border-red-500' : ''}
                />
                {state.fieldErrors.email && <p className="text-sm text-red-500">{state.fieldErrors.email}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/auth/password/reset" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={state.isLoading}
                  className={state.fieldErrors.password ? 'border-red-500' : ''}
                />
                {state.fieldErrors.password && <p className="text-sm text-red-500">{state.fieldErrors.password}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={state.isLoading}>
                {state.isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {links && (
              <div className="space-y-2 text-center">
                {links.register && (
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link href={links.register.href} className="text-primary hover:underline">
                      {links.register.text}
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
