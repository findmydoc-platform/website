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
    <div className="flex justify-center items-start px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Reset your password</CardTitle>
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
              <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm" role="alert">
                {formState.error}
              </div>
            )}
            {isSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm" role="status">
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
