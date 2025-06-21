'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/auth/utilities/client'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()

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
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h1 className="text-2xl font-semibold">Logging out...</h1>
        <p className="text-muted-foreground">Please wait while we sign you out.</p>
      </div>
    </div>
  )
}
