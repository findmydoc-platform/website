'use client'

import * as React from 'react'

import { captureSupabaseAuthHashFromUrl } from '@/auth/utilities/hydrateSessionFromHash'

export function SupabaseAuthHashUrlScrubber() {
  React.useLayoutEffect(() => {
    const captureAuthHash = () => {
      captureSupabaseAuthHashFromUrl()
    }

    captureAuthHash()
    window.addEventListener('hashchange', captureAuthHash)

    return () => {
      window.removeEventListener('hashchange', captureAuthHash)
    }
  }, [])

  return null
}
