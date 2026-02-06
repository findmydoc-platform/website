'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type PostActionBarProps = {
  backLink?: {
    label?: string
    href?: string
  }
  shareButton?: {
    label?: string
    url?: string
  }
  className?: string
  layoutClassName?: string
  contentClassName?: string
}

export const PostActionBar: React.FC<PostActionBarProps> = ({
  backLink = { label: 'Back to Blog', href: '/posts' },
  shareButton = { label: 'Share' },
  className,
  layoutClassName,
  contentClassName,
}) => {
  const handleShare = async () => {
    const url = shareButton?.url || (typeof window !== 'undefined' ? window.location.href : '')

    if (navigator.share) {
      try {
        await navigator.share({
          url,
        })
      } catch (err) {
        // User cancelled or share failed
        console.error('Share failed:', err)
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url)
        // TODO: Show toast notification "Link kopiert!"
      } catch (err) {
        console.error('Copy failed:', err)
      }
    }
  }

  return (
    <Container className={className}>
      <div className={cn('grid grid-cols-1 lg:grid-cols-12', layoutClassName)}>
        <div
          className={cn(
            'flex items-center justify-between border-b py-6 lg:col-span-8 lg:col-start-3',
            contentClassName,
          )}
        >
          {/* Back Link */}
          <Link
            href={backLink.href || '/posts'}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{backLink.label || 'Back to Blog'}</span>
          </Link>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label={shareButton?.label || 'Share'}
          >
            <Share2 className="h-4 w-4" />
            <span>{shareButton?.label || 'Share'}</span>
          </button>
        </div>
      </div>
    </Container>
  )
}
