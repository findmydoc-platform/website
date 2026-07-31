'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/auth/utilities/supaBaseClient'
import { resetPostHogBrowserIdentity } from '@/posthog/client-api'
import { Heading } from '@/components/atoms/Heading'

const EXIT_PREVIEW_PATH = `/next/exit-preview?redirect=${encodeURIComponent('/admin/login')}`

export default function LogoutPage() {
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

      // Small delay to show the "logging out" message.
      setTimeout(() => {
        router.replace(EXIT_PREVIEW_PATH)
      }, 1000)
    }

    handleLogout()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <Heading as="h1" align="center" size="h4" className="text-2xl font-semibold">
          Logging out...
        </Heading>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  )
}
