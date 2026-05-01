'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { Heading } from '@/components/atoms/Heading'
import { createClient } from '@/auth/utilities/supaBaseClient'
import { posthog } from '@/posthog/client-only'

export default function PublicLogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const supabase = createClient()

        await supabase.auth.signOut()

        try {
          posthog.reset()
        } catch (error) {
          console.warn('Failed to reset PostHog user:', error)
        }

        setTimeout(() => {
          router.push('/login/patient')
        }, 1000)
      } catch (error) {
        console.error('Logout error:', error)
        router.push('/login/patient')
      }
    }

    handleLogout()
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <Heading as="h1" align="center" size="h4" className="text-2xl font-semibold">
          Signing you out...
        </Heading>
        <p className="text-muted-foreground">Please wait while we end your session.</p>
      </div>
    </div>
  )
}
