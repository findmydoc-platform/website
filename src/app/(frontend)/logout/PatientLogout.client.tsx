'use client'

import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'

type PatientLogoutProps = {
  title: string
  description: string
  exitPreviewPath: string
  errorMessage: string
  retryLabel: string
  signOutAction: () => Promise<boolean>
}

export function PatientLogout({
  title,
  description,
  exitPreviewPath,
  errorMessage,
  retryLabel,
  signOutAction,
}: PatientLogoutProps) {
  const router = useRouter()
  const started = useRef(false)
  const [failed, setFailed] = useState(false)

  const signOut = useCallback(() => {
    setFailed(false)

    startTransition(async () => {
      const succeeded = await signOutAction().catch(() => false)
      if (!succeeded) {
        setFailed(true)
        return
      }

      try {
        resetPostHogBrowserIdentity()
      } catch (error) {
        console.error('Logout identity reset error:', error)
      }

      router.replace(exitPreviewPath)
    })
  }, [exitPreviewPath, router, signOutAction])

  useEffect(() => {
    if (started.current) return
    started.current = true
    signOut()
  }, [signOut])

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="space-y-4 text-center">
        {failed ? (
          <>
            <div role="alert">
              <Heading as="h1" align="center" size="h4" className="text-2xl font-semibold">
                {errorMessage}
              </Heading>
            </div>
            <Button type="button" className="min-h-11" onClick={signOut}>
              {retryLabel}
            </Button>
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="mx-auto h-12 w-12 rounded-full border-b-2 border-primary motion-safe:animate-spin"
            />
            <Heading as="h1" align="center" size="h4" className="text-2xl font-semibold">
              {title}
            </Heading>
            <p role="status" className="text-muted-foreground">
              {description}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
