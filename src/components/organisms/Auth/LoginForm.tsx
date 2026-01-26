'use client'

import type React from 'react'
import { useState, createContext, useContext } from 'react'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Alert } from '@/components/atoms/alert'
import { Card, CardContent } from '@/components/atoms/card'
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

// 1. Context
type LoginFormContextType = {
  state: LoginState
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

const LoginFormContext = createContext<LoginFormContextType | null>(null)

const useLoginFormContext = () => {
  const context = useContext(LoginFormContext)
  if (!context) {
    throw new Error('useLoginFormContext must be used within LoginForm.Root')
  }
  return context
}

// 2. Sub-components
export const Root = ({
  children,
  className,
  userTypes,
  redirectPath,
  loginHandler = handleLogin,
}: {
  children: React.ReactNode
  className?: string
  userTypes: UserType[] | UserType
  redirectPath?: string
  loginHandler?: (data: LoginRequest) => Promise<LoginResponse | LoginError>
}) => {
  const [state, setState] = useState<LoginState>({
    isLoading: false,
    error: null,
    fieldErrors: {},
  })
  const router = useRouter()
  const allowedUserTypes = Array.isArray(userTypes) ? userTypes : [userTypes]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState((prev) => ({ ...prev, error: null, fieldErrors: {}, isLoading: true }))

    const formData = new FormData(e.target as HTMLFormElement)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const result = await loginHandler({ email, password, allowedUserTypes })

      if ('error' in result) {
        const errorResult = result as LoginError
        if (errorResult.details && errorResult.details.length > 0) {
          const newFieldErrors: Record<string, string> = {}
          errorResult.details.forEach((detail) => {
            newFieldErrors[detail.field] = detail.message
          })
          setState((prev) => ({ ...prev, fieldErrors: newFieldErrors, error: null }))
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
    } catch (error: unknown) {
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
    <LoginFormContext.Provider value={{ state, handleSubmit }}>
      <div className={cn('flex items-start justify-center px-4 py-12', className)}>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </LoginFormContext.Provider>
  )
}

export const Header = ({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) => {
  return (
    <div className={cn('mb-6 space-y-2 text-center', className)}>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

export const Status = ({ message, variant = 'info' }: { message?: string; variant?: StatusVariant }) => {
  const { state } = useLoginFormContext()

  if (message) {
    return (
      <div className="mb-4">
        <Alert variant={variant}>{message}</Alert>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="mb-4">
        <Alert variant="error">{state.error}</Alert>
      </div>
    )
  }

  return null
}

export const Form = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const { handleSubmit } = useLoginFormContext()
  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {children}
    </form>
  )
}

export const EmailField = ({
  label = 'Email',
  placeholder = 'name@example.com',
  className,
}: {
  label?: string
  placeholder?: string
  className?: string
}) => {
  const { state } = useLoginFormContext()
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="email">{label}</Label>
      <Input
        id="email"
        name="email"
        type="email"
        placeholder={placeholder}
        required
        disabled={state.isLoading}
        className={cn(state.fieldErrors.email && 'border-destructive')}
      />
      {state.fieldErrors.email && <p className="text-sm text-error">{state.fieldErrors.email}</p>}
    </div>
  )
}

export const PasswordField = ({
  label = 'Password',
  forgotPasswordHref,
  className,
}: {
  label?: string
  forgotPasswordHref?: string
  className?: string
}) => {
  const { state } = useLoginFormContext()
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor="password">{label}</Label>
        {forgotPasswordHref && (
          <Link href={forgotPasswordHref} className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
        )}
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
  )
}

export const SubmitButton = ({
  children,
  loadingText = 'Signing in...',
  className,
}: {
  children: React.ReactNode
  loadingText?: string
  className?: string
}) => {
  const { state } = useLoginFormContext()
  return (
    <Button type="submit" className={cn('w-full', className)} disabled={state.isLoading}>
      {state.isLoading ? loadingText : children}
    </Button>
  )
}

export const Footer = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn('mt-4 space-y-2 text-center', className)}>{children}</div>
}

export const LoginForm = {
  Root,
  Header,
  Status,
  Form,
  EmailField,
  PasswordField,
  SubmitButton,
  Footer,
}
