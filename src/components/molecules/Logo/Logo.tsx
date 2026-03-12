import { PreviewBadge } from '@/components/atoms/PreviewBadge'
import { cn } from '@/utilities/ui'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
  variant?: 'dark' | 'white'
  alt?: string
  src?: string
  showPreviewBadge?: boolean
}

export const Logo = (props: Props) => {
  const {
    loading: loadingFromProps,
    priority: priorityFromProps,
    className,
    variant = 'dark',
    alt = 'findmydoc',
    src: srcFromProps,
    showPreviewBadge = false,
  } = props
  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  const logoSrc = srcFromProps ?? (variant === 'white' ? `/fmd-logo-1-white.png` : `/fmd-logo-1-dark.svg`)

  return (
    <span className="relative inline-flex w-fit">
      {/* eslint-disable @next/next/no-img-element */}
      <img
        alt={alt}
        width={200}
        height={75}
        loading={loading}
        fetchPriority={priority}
        decoding="async"
        className={cn('h-20 w-auto object-contain', className)}
        src={logoSrc}
      />
      {showPreviewBadge ? <PreviewBadge /> : null}
    </span>
  )
}
