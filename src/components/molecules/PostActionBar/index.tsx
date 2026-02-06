import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import { Container } from '@/components/molecules/Container'

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
}

export const PostActionBar: React.FC<PostActionBarProps> = ({
  backLink = { label: 'Zurück zum Blog', href: '/posts' },
  shareButton = { label: 'Teilen' },
  className,
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
      <div className="flex items-center justify-between border-b py-4">
        {/* Back Link */}
        <Link
          href={backLink.href || '/posts'}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{backLink.label || 'Zurück zum Blog'}</span>
        </Link>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Teilen"
        >
          <Share2 className="h-4 w-4" />
          <span>{shareButton?.label || 'Teilen'}</span>
        </button>
      </div>
    </Container>
  )
}
