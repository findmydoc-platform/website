'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/atoms/card'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Button } from '@/components/atoms/button'
import { Alert } from '@/components/atoms/alert'
import { Heading } from '@/components/atoms/Heading'
import { createPasswordResetCompleteFlash, writeAuthFlash } from '@/auth/utilities/authFlash'
import { resolvePasswordResetLoginTarget, type PasswordResetLoginTarget } from '@/auth/utilities/loginRedirects'
import { createClient } from '@/auth/utilities/supaBaseClient'
import { usePublicFormValidation } from '@/components/molecules/PublicFormValidation'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

type PasswordState = z.infer<typeof passwordSchema>

const expiredRecoveryHref = '/auth/password/reset?reason=expired'

export function ResetPasswordCompleteForm({ error }: { error?: string }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [isSessionReady, setSessionReady] = useState(false)
  const [loginTarget, setLoginTarget] = useState<PasswordResetLoginTarget>(() =>
    resolvePasswordResetLoginTarget(undefined),
  )
  const formValidation = usePublicFormValidation({
    messages: {
      confirmPassword: { valueMissing: 'Confirm your new password.' },
      password: {
        tooShort: 'Password must be at least 8 characters.',
        valueMissing: 'This field is required.',
      },
    },
  })
  const [formState, setFormState] = useState<{
    status: 'idle' | 'saving' | 'redirecting' | 'sign-out-warning'
    error: string | null
  }>({
    status: 'idle',
    error: null,
  })

  useEffect(() => {
    let active = true

    const checkSession = async () => {
      if (error) {
        router.replace(expiredRecoveryHref)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active) return

      if (!session) {
        router.replace(expiredRecoveryHref)
        return
      }

      setLoginTarget(resolvePasswordResetLoginTarget(session.user.app_metadata?.user_type))
      setSessionReady(true)
    }

    void checkSession()

    return () => {
      active = false
    }
  }, [error, router, supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSessionReady) {
      return
    }

    setFormState((prev) => ({ ...prev, error: null }))

    const form = event.currentTarget
    if (!formValidation.validateForm(form)) return

    const formData = new FormData(form)
    const payload: PasswordState = {
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    }

    const validation = passwordSchema.safeParse(payload)

    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Enter a valid password.'
      const fieldName = validation.error.issues[0]?.path[0]

      if (fieldName === 'password' || fieldName === 'confirmPassword') {
        formValidation.setCustomFieldError(fieldName, message)
        document.getElementById(fieldName)?.focus()
      } else {
        setFormState({ status: 'idle', error: message })
      }
      return
    }

    setFormState({ status: 'saving', error: null })

    const { error } = await supabase.auth.updateUser({ password: validation.data.password })

    if (error) {
      setFormState({ status: 'idle', error: error.message || 'Unable to update password.' })
      return
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })

    if (signOutError) {
      const { error: localSignOutError } = await supabase.auth.signOut({ scope: 'local' })

      if (localSignOutError) {
        setFormState({
          status: 'idle',
          error: signOutError.message || 'Password updated, but we could not finish signing you out.',
        })
        return
      }

      resetPostHogBrowserIdentity()
      setSessionReady(false)
      setFormState({
        status: 'sign-out-warning',
        error:
          'Password updated, but we could not sign out all active sessions. We signed out this browser. Please sign in again and contact support if you notice unfamiliar activity.',
      })
      return
    }

    setFormState({ status: 'redirecting', error: null })
    formValidation.clearAllFieldErrors()
    resetPostHogBrowserIdentity()
    writeAuthFlash(createPasswordResetCompleteFlash())
    router.replace(loginTarget.href)
    router.refresh()
  }

  const isSaving = formState.status === 'saving'
  const isRedirecting = formState.status === 'redirecting'

  return (
    <div className="flex items-start justify-center py-6 sm:px-4 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Heading as="h1" align="center" size="h4" className="font-semibold">
            Choose a new password
          </Heading>
          <CardDescription className="text-center">
            Set a new password to finish recovering your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={handleSubmit}
            onInvalid={formValidation.handleInvalid}
            aria-busy={isSaving || isRedirecting}
            noValidate
          >
            {formState.error && formState.status !== 'sign-out-warning' && (
              <Alert variant="error">{formState.error}</Alert>
            )}
            {formState.status === 'sign-out-warning' && formState.error && (
              <Alert variant="warning" role="status" aria-live="polite" className="space-y-2">
                <p>{formState.error}</p>
                <p>
                  <Link href={loginTarget.href} className="text-primary hover:underline">
                    Continue to sign in
                  </Link>
                  .
                </p>
              </Alert>
            )}
            {isRedirecting && (
              <Alert variant="success" role="status" aria-live="polite" className="space-y-2">
                <p>Password updated successfully. Redirecting to sign in.</p>
                <p>
                  <Link href={loginTarget.href} className="text-primary hover:underline">
                    Continue to sign in
                  </Link>
                  .
                </p>
              </Alert>
            )}
            <Field data-invalid={formValidation.getFieldError('password') ? true : undefined}>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                disabled={!isSessionReady || isSaving || isRedirecting}
                onChange={formValidation.handleFieldChange}
                {...formValidation.getFieldProps('password')}
              />
              <FieldError id={formValidation.getFieldErrorId('password')}>
                {formValidation.getFieldError('password')}
              </FieldError>
            </Field>
            <Field data-invalid={formValidation.getFieldError('confirmPassword') ? true : undefined}>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                disabled={!isSessionReady || isSaving || isRedirecting}
                onChange={formValidation.handleFieldChange}
                {...formValidation.getFieldProps('confirmPassword')}
              />
              <FieldError id={formValidation.getFieldErrorId('confirmPassword')}>
                {formValidation.getFieldError('confirmPassword')}
              </FieldError>
            </Field>
            <Button type="submit" className="w-full" disabled={!isSessionReady || isSaving || isRedirecting}>
              {isSaving ? 'Updating password...' : isRedirecting ? 'Redirecting...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
