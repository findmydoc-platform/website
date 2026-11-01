'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { postHogBrowserEvents, usePostHogAnalyticsReady } from '@/posthog/client-api'

/** Scope acceptance to the rendered result view, never the pending browser URL. */
export function useListingResultImpressions(resultViewSignature: string) {
  const isReady = usePostHogAnalyticsReady()
  const view = useMemo(
    () => ({ resultViewSignature, elements: new Map<string, HTMLElement>(), accepted: new Set<string>() }),
    [resultViewSignature],
  )
  const observer = useRef<IntersectionObserver | null>(null)

  const captureVisibleResults = useCallback(() => {
    if (!isReady || document.visibilityState !== 'visible' || !document.hasFocus()) return
    const viewport = window.visualViewport
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportRight = viewportLeft + (viewport?.width ?? document.documentElement.clientWidth)
    const viewportBottom = viewportTop + (viewport?.height ?? document.documentElement.clientHeight)
    for (const [clinicId, element] of view.elements) {
      if (view.accepted.has(clinicId) || !element.isConnected) continue
      const rect = element.getBoundingClientRect()
      const styles = getComputedStyle(element)
      const visibleWidth = Math.min(rect.right, viewportRight) - Math.max(rect.left, viewportLeft)
      const visibleHeight = Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop)
      if (visibleWidth <= 0 || visibleHeight <= 0 || styles.visibility !== 'visible' || styles.opacity === '0') continue
      if (postHogBrowserEvents.clinicSearchResultViewed({ clinic_id: clinicId })) view.accepted.add(clinicId)
    }
  }, [isReady, view])

  const onResultElement = useCallback(
    (id: string | number, element: HTMLElement | null) => {
      const clinicId = String(id)
      const previous = view.elements.get(clinicId)
      if (previous) observer.current?.unobserve(previous)
      if (element) {
        view.elements.set(clinicId, element)
        observer.current?.observe(element)
      } else {
        view.elements.delete(clinicId)
      }
    },
    [view],
  )

  useEffect(() => {
    const intersectionObserver = new IntersectionObserver(captureVisibleResults, { threshold: 0 })
    observer.current = intersectionObserver
    for (const element of view.elements.values()) intersectionObserver.observe(element)
    // Edge contact can have zero area without a later threshold-0 notice.
    // Scroll and activation therefore recheck current geometry as well.
    window.addEventListener('scroll', captureVisibleResults, { capture: true, passive: true })
    window.addEventListener('resize', captureVisibleResults)
    window.addEventListener('focus', captureVisibleResults)
    window.visualViewport?.addEventListener('scroll', captureVisibleResults)
    window.visualViewport?.addEventListener('resize', captureVisibleResults)
    document.addEventListener('visibilitychange', captureVisibleResults)
    captureVisibleResults()
    return () => {
      intersectionObserver.disconnect()
      observer.current = null
      window.removeEventListener('scroll', captureVisibleResults, true)
      window.removeEventListener('resize', captureVisibleResults)
      window.removeEventListener('focus', captureVisibleResults)
      window.visualViewport?.removeEventListener('scroll', captureVisibleResults)
      window.visualViewport?.removeEventListener('resize', captureVisibleResults)
      document.removeEventListener('visibilitychange', captureVisibleResults)
    }
  }, [captureVisibleResults, view])

  return onResultElement
}
