'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/atoms/alert'
import { Button } from '@/components/atoms/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card'

type TokenHashFlow = 'invite' | 'recovery'

export function ConfirmTokenHashForm({ type }: Readonly<{ type: TokenHashFlow }>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  const confirm = async () => {
    setPending(true)
    setError(false)
    try {
      const response = await fetch('/api/auth/callback', {
        body: '{}',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        redirect: 'error',
      })
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok || typeof body.redirectTo !== 'string' || !body.redirectTo.startsWith('/')) {
        setError(true)
        return
      }
      window.location.assign(body.redirectTo)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-start justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {type === 'invite' ? 'Confirm your invitation' : 'Confirm your password reset'}
          </CardTitle>
          <CardDescription className="text-center">
            Continue only if you requested this email. The secure link is used after your confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {error ? (
            <Alert variant="error" role="alert">
              This link is invalid or has expired. Request a new email to continue.
            </Alert>
          ) : null}
          <Button className="w-full" disabled={pending} onClick={confirm}>
            {pending ? 'Confirming...' : type === 'invite' ? 'Continue invitation' : 'Continue password reset'}
          </Button>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline" href="/">
            Return to findmydoc
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
