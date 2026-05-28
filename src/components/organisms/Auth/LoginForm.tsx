'use client'

import type React from 'react'
import { startTransition, useState, createContext, useContext } from 'react'
import { Button } from '@/components/atoms/button'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Alert } from '@/components/atoms/alert'
import { Card, CardContent } from '@/components/atoms/card'
import { Heading } from '@/components/atoms/Heading'
import { type PublicFormValidation, usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
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
  clearFieldError: (fieldName: string) => void
  formValidation: PublicFormValidation
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>
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
  const formValidation = usePublicFormValidation()
  const router = useRouter()
  const allowedUserTypes = Array.isArray(userTypes) ? userTypes : [userTypes]

  const clearFieldError = (fieldName: string) => {
    formValidation.clearFieldError(fieldName)
    setState((prev) => {
      if (!prev.fieldErrors[fieldName]) return prev

      const { [fieldName]: _removed, ...remaining } = prev.fieldErrors
      return { ...prev, fieldErrors: remaining, error: null }
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState((prev) => ({ ...prev, error: null, fieldErrors: {}, isLoading: false }))

    const form = e.currentTarget
    if (!formValidation.validateForm(form)) return

    setState((prev) => ({ ...prev, isLoading: true }))

    const formData = new FormData(form)
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
      startTransition(() => {
        router.push(finalRedirectPath)
        router.refresh()
      })
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
    <LoginFormContext.Provider value={{ state, clearFieldError, formValidation, handleSubmit }}>
      <div className={cn('flex items-start justify-center px-0 py-8 sm:px-4 sm:py-12', className)}>
        <Card className="w-full max-w-md">
          <CardContent className="p-5 pt-5 sm:p-6 sm:pt-6">{children}</CardContent>
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
      <Heading
        as="h1"
        align="center"
        size="h4"
        className="text-[1.65rem] leading-tight font-semibold tracking-tight text-balance sm:text-2xl"
      >
        {title}
      </Heading>

      <p className="mx-auto max-w-[28rem] text-sm leading-6 text-balance text-muted-foreground">{description}</p>
    </div>
  )
}

export const Status = ({ message, variant = 'info' }: { message?: string; variant?: StatusVariant }) => {
  const { state } = useLoginFormContext()

  if (message) {
    return (
      <div className="mb-4">
        <Alert variant={variant} className="text-left break-words">
          {message}
        </Alert>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="mb-4">
        <Alert variant="error" className="text-left break-words">
          {state.error}
        </Alert>
      </div>
    )
  }

  return null
}

export const Form = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const { formValidation, handleSubmit } = useLoginFormContext()
  return (
    <form
      onSubmit={handleSubmit}
      onInvalid={formValidation.handleInvalid}
      className={cn('space-y-4', className)}
      noValidate
    >
      {children}
    </form>
  )
}

export const EmailField = ({
  label = 'Email',
  placeholder = 'name@example.com',
  autoComplete = 'email',
  className,
}: {
  label?: string
  placeholder?: string
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete']
  className?: string
}) => {
  const { clearFieldError, formValidation, state } = useLoginFormContext()
  const fieldError = formValidation.getFieldError('email') ?? state.fieldErrors.email
  const fieldErrorId = formValidation.getFieldErrorId('email')

  return (
    <Field data-invalid={fieldError ? true : undefined} className={className}>
      <Label htmlFor="email">{label}</Label>
      <Input
        id="email"
        name="email"
        type="email"
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        disabled={state.isLoading}
        aria-describedby={fieldError ? fieldErrorId : undefined}
        aria-invalid={fieldError ? true : undefined}
        onChange={() => clearFieldError('email')}
      />
      <FieldError id={fieldErrorId}>{fieldError}</FieldError>
    </Field>
  )
}

export const PasswordField = ({
  label = 'Password',
  forgotPasswordHref,
  autoComplete = 'current-password',
  className,
}: {
  label?: string
  forgotPasswordHref?: string
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete']
  className?: string
}) => {
  const { clearFieldError, formValidation, state } = useLoginFormContext()
  const fieldError = formValidation.getFieldError('password') ?? state.fieldErrors.password
  const fieldErrorId = formValidation.getFieldErrorId('password')

  return (
    <Field data-invalid={fieldError ? true : undefined} className={className}>
      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
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
        autoComplete={autoComplete}
        required
        disabled={state.isLoading}
        aria-describedby={fieldError ? fieldErrorId : undefined}
        aria-invalid={fieldError ? true : undefined}
        onChange={() => clearFieldError('password')}
      />
      <FieldError id={fieldErrorId}>{fieldError}</FieldError>
    </Field>
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
  return <div className={cn('mt-5 space-y-3 text-center [&_a]:break-words [&_p]:leading-5', className)}>{children}</div>
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
