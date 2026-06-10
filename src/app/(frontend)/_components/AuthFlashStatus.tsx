'use client'

import { useEffect, useState } from 'react'
import { consumeAuthFlash, getAuthFlashMessage } from '@/auth/utilities/authFlash'
import { Alert } from '@/components/atoms/alert'

export function AuthFlashStatus() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const flash = consumeAuthFlash()
    setMessage(flash ? getAuthFlashMessage(flash) : null)
  }, [])

  if (!message) return null

  return (
    <div className="mb-4">
      <Alert variant="success" role="status" aria-live="polite" aria-atomic="true" className="text-left break-words">
        {message}
      </Alert>
    </div>
  )
}
