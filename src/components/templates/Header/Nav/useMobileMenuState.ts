'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'

type UseMobileMenuStateOptions = {
  getFallbackFocusTarget?: () => HTMLElement | null
  menuButtonRef?: RefObject<HTMLButtonElement | null>
}

export function useMobileMenuState(
  hasMenuItems: boolean,
  { getFallbackFocusTarget, menuButtonRef }: UseMobileMenuStateOptions = {},
) {
  const [requestedOpen, setRequestedOpen] = useState(false)
  const isOpen = hasMenuItems && requestedOpen

  const focusMenuButton = useCallback(() => {
    menuButtonRef?.current?.focus({ preventScroll: true })
  }, [menuButtonRef])

  const focusFallbackTarget = useCallback(() => {
    getFallbackFocusTarget?.()?.focus({ preventScroll: true })
  }, [getFallbackFocusTarget])

  const close = useCallback(
    ({ returnFocus = false }: { returnFocus?: boolean } = {}) => {
      setRequestedOpen(false)

      if (returnFocus) {
        focusMenuButton()
      }
    },
    [focusMenuButton],
  )

  const toggle = useCallback(() => {
    setRequestedOpen((current) => !current)
  }, [])

  useEffect(() => {
    if (!hasMenuItems && requestedOpen) {
      setRequestedOpen(false)
      focusFallbackTarget()
    }
  }, [focusFallbackTarget, hasMenuItems, requestedOpen])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close({ returnFocus: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close, isOpen])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        close()
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [close])

  return {
    close,
    isOpen,
    toggle,
  }
}
