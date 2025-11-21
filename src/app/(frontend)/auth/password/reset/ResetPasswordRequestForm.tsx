'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const formSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
})

type FormState =
  | { status: 'idle'; error: string | null }
  | { status: 'submitting'; error: string | null }
  | { status: 'success'; error: null }

type ParsedData = z.infer<typeof formSchema>

async function submitRequest(data: ParsedData) {
  const response = await fetch('/api/auth/password/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : 'Unable to send reset email.'
    throw new Error(message)
  }
}

export function ResetPasswordRequestForm() {
  const [formState, setFormState] = useState<FormState>({ status: 'idle', error: null })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormState({ status: 'submitting', error: null })

    const formData = new FormData(event.currentTarget)
    const result = formSchema.safeParse({ email: formData.get('email') })

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Enter a valid email address.'
      setFormState({ status: 'idle', error: message })
      return
    }

    try {
      await submitRequest(result.data)
      setFormState({ status: 'success', error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send reset email.'
      setFormState({ status: 'idle', error: message })
    }
  }

  const isSubmitting = formState.status === 'submitting'
  const isSuccess = formState.status === 'success'

  return (
    <div className="flex items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Reset your password</CardTitle>
          <CardDescription className="text-center">
            Enter the email associated with your account and we&apos;ll send instructions to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            method="post"
            action="/api/auth/password/reset"
            onSubmit={handleSubmit}
            className="space-y-4"
            noValidate
          >
            {formState.error && (
              <div className="rounded-md border intent-error p-3 text-sm text-intent-error" role="alert">
                {formState.error}
              </div>
            )}
            {isSuccess && (
              <div className="rounded-md border intent-success p-3 text-sm text-intent-success" role="status">
                If the email exists in our records you will receive a password reset link shortly.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required disabled={isSubmitting || isSuccess} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || isSuccess}>
              {isSubmitting ? 'Sending reset email...' : 'Send reset instructions'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
