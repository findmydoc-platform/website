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
}

export function BaseLoginForm({
  title,
  description,
  userTypes,
  redirectPath,
  emailPlaceholder = 'name@example.com',
  links,
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
            error:
              errorResult.message ||
              errorResult.error ||
              'An unexpected error occurred. Please try again.',
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
    <div className="flex justify-center items-start px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{title}</CardTitle>
          <CardDescription className="text-center">{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {state.error && (
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">{state.error}</div>
            )}
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
                {state.fieldErrors.email && (
                  <p className="text-sm text-red-500">{state.fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Button variant="link" className="px-0 font-normal h-auto" size="sm">
                    Forgot password?
                  </Button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={state.isLoading}
                  className={state.fieldErrors.password ? 'border-red-500' : ''}
                />
                {state.fieldErrors.password && (
                  <p className="text-sm text-red-500">{state.fieldErrors.password}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={state.isLoading}>
                {state.isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {links && (
              <div className="text-center space-y-2">
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
