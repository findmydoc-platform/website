'use client'

import type React from 'react'
import { useState } from 'react'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Alert } from '@/components/atoms/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { handleLogin } from '@/auth/utilities/loginHandler'
import {
  UserType,
  LoginState,
  LoginResponse,
  LoginError,
  LoginRequest,
} from '@/components/organisms/Auth/types/loginTypes'
import { cn } from '@/utilities/ui'

type StatusVariant = 'success' | 'info' | 'warning'

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
  loginHandler?: (data: LoginRequest) => Promise<LoginResponse | LoginError>
}

export function BaseLoginForm({
  title,
  description,
  userTypes,
  redirectPath,
  emailPlaceholder = 'name@example.com',
  links,
  statusMessage,
  loginHandler = handleLogin,
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
      const result = await loginHandler({ email, password, allowedUserTypes })

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
            {statusMessage && <Alert variant={statusMessage.variant ?? 'info'}>{statusMessage.text}</Alert>}
            {state.error && <Alert variant="error">{state.error}</Alert>}
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
                  className={cn(state.fieldErrors.email && 'border-destructive')}
                />
                {state.fieldErrors.email && <p className="text-sm text-error">{state.fieldErrors.email}</p>}
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
                  className={cn(state.fieldErrors.password && 'border-destructive')}
                />
                {state.fieldErrors.password && <p className="text-sm text-error">{state.fieldErrors.password}</p>}
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
