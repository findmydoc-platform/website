'use client'

import * as React from 'react'
import { Button } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

type ListingFiltersJumpBarProps = {
  targetId: string
}

type BarPlacement = {
  left: number
  width: number
}

const VIEWPORT_MARGIN_PX = 16
const VISIBILITY_DELAY_MS = 180

export function ListingFiltersJumpBar({ targetId }: ListingFiltersJumpBarProps) {
  const [isTargetVisible, setIsTargetVisible] = React.useState(true)
  const [isDelayedVisible, setIsDelayedVisible] = React.useState(false)
  const [placement, setPlacement] = React.useState<BarPlacement>({
    left: VIEWPORT_MARGIN_PX,
    width: 320,
  })

  React.useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return

    const updatePlacement = () => {
      const rect = target.getBoundingClientRect()
      const width = Math.max(0, Math.round(rect.width))
      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN_PX
      const nextLeft = Math.min(Math.max(VIEWPORT_MARGIN_PX, Math.round(rect.left)), maxLeft)

      setPlacement((current) => {
        if (current.left === nextLeft && current.width === width) {
          return current
        }

        return {
          left: nextLeft,
          width,
        }
      })
    }

    updatePlacement()

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTargetVisible(entry?.isIntersecting ?? true)
      },
      {
        threshold: 0.05,
      },
    )

    observer.observe(target)

    const resizeObserver = new ResizeObserver(() => {
      updatePlacement()
    })
    resizeObserver.observe(target)

    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, { passive: true })

    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement)
    }
  }, [targetId])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsDelayedVisible(!isTargetVisible)
    }, VISIBILITY_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isTargetVisible])

  if (placement.width <= 0) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-auto z-40 hidden transition-all duration-200 ease-out lg:block',
        isDelayedVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
      )}
      style={{
        left: `${placement.left}px`,
        width: `${placement.width}px`,
      }}
    >
      <div className="rounded-2xl border border-border bg-background p-2 shadow-sm">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-full justify-center"
          hoverEffect="none"
          onClick={() => {
            const target = document.getElementById(targetId)
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          Jump to Filter
        </Button>
      </div>
    </div>
  )
}
