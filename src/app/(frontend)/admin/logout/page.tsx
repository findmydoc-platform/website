'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/auth/utilities/supaBaseClient'
import { posthog } from '@/posthog/client-only'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const supabase = createClient()

        await supabase.auth.signOut()

        // Reset PostHog user identification before logout
        try {
          posthog.reset()
        } catch (error) {
          console.warn('Failed to reset PostHog user:', error)
        }

        // Small delay to show the "logging out" message
        setTimeout(() => {
          router.push('/admin/login')
        }, 1000)
      } catch (error) {
        console.error('Logout error:', error)
        router.push('/admin/login')
      }
    }

    handleLogout()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <h1 className="text-2xl font-semibold">Logging out...</h1>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  )
}
