'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/auth/utilities/supaBaseClient'

const tokenSchema = z.object({
  type: z.literal('recovery'),
  code: z.string().min(1, 'Recovery code is missing.'),
})

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

export function ResetPasswordCompleteForm() {
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [isSessionReady, setSessionReady] = useState(false)
  const [formState, setFormState] = useState<{ status: 'idle' | 'saving'; error: string | null; success: boolean }>(
    { status: 'idle', error: null, success: false },
  )

  const parsedToken = useMemo(() => {
    const type = searchParams.get('type')
    const code = searchParams.get('code')
    const validation = tokenSchema.safeParse({ type, code })
    return validation
  }, [searchParams])

  useEffect(() => {
    if (!parsedToken.success) {
      setTokenError('The password recovery link is invalid or has expired.')
      return
    }

    let active = true

    const establishSession = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(parsedToken.data.code)
      if (!active) return

      if (error) {
        setTokenError(error.message || 'Unable to validate the recovery link.')
        return
      }

      setSessionReady(true)
    }

    void establishSession()

    return () => {
      active = false
    }
  }, [parsedToken, supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isSessionReady) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const payload: PasswordState = {
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    }

    const validation = passwordSchema.safeParse(payload)

    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Enter a valid password.'
      setFormState({ status: 'idle', error: message, success: false })
      return
    }

    setFormState({ status: 'saving', error: null, success: false })

    const { error } = await supabase.auth.updateUser({ password: validation.data.password })

    if (error) {
      setFormState({ status: 'idle', error: error.message || 'Unable to update password.', success: false })
      return
    }

    setFormState({ status: 'idle', error: null, success: true })
  }

  const isSaving = formState.status === 'saving'

  return (
    <div className="flex justify-center items-start px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Choose a new password</CardTitle>
          <CardDescription className="text-center">
            Set a new password to finish recovering your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {tokenError && (
            <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm" role="alert">
              {tokenError}
            </div>
          )}
          {!tokenError && (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              {formState.error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm" role="alert">
                  {formState.error}
                </div>
              )}
              {formState.success && (
                <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm space-y-2" role="status">
                  <p>Password updated successfully.</p>
                  <p>
                    <Link href="/login/patient" className="text-primary hover:underline">
                      Return to sign in
                    </Link>
                    .
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" required disabled={!isSessionReady || isSaving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  disabled={!isSessionReady || isSaving}
                />
              </div>
              <Button type="submit" className="w-full" disabled={!isSessionReady || isSaving || formState.success}>
                {isSaving ? 'Updating password...' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
