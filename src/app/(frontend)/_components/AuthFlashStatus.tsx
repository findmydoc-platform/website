'use client'

import { useEffect, useState } from 'react'
import {
  consumeAuthFlash,
  getAuthFlashMessage,
  type AuthFlashKind,
  type AuthFlashPayload,
} from '@/auth/utilities/authFlash'
import { Alert } from '@/components/atoms/alert'

export function AuthFlashStatus({ messages }: { messages?: Record<AuthFlashKind, string> }) {
  const [flash, setFlash] = useState<AuthFlashPayload | null>(null)

  useEffect(() => {
    const nextFlash = consumeAuthFlash()
    if (nextFlash) setFlash(nextFlash)
  }, [])

  if (!flash) return null
  const message = messages?.[flash.kind] ?? getAuthFlashMessage(flash)

  return (
    <div className="mb-4">
      <Alert variant="success" role="status" aria-live="polite" aria-atomic="true" className="text-left break-words">
        {message}
      </Alert>
    </div>
  )
}
