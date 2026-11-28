'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Heading } from '@/components/atoms/Heading'
import { createClient } from '@/auth/utilities/supaBaseClient'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'

type PatientLogoutProps = {
  title: string
  description: string
  exitPreviewPath: string
}

export function PatientLogout({ title, description, exitPreviewPath }: PatientLogoutProps) {
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const supabase = createClient()

        await supabase.auth.signOut()
      } catch (error) {
        console.error('Logout error:', error)
      }

      try {
        resetPostHogBrowserIdentity()
      } catch (error) {
        console.error('Logout identity reset error:', error)
      }

      setTimeout(() => {
        router.replace(exitPreviewPath)
      }, 1000)
    }

    handleLogout()
  }, [exitPreviewPath, router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="space-y-4 text-center">
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
      </div>
    </div>
  )
}
