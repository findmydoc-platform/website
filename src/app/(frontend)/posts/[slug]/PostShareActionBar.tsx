'use client'

import React from 'react'

import { PostActionBar, type PostActionBarProps } from '@/components/molecules/PostActionBar'
import { sharePostUrl } from '@/utilities/blog/sharePostUrl'

type PostShareActionBarProps = {
  shareUrl?: string
  backLink?: PostActionBarProps['backLink']
  shareLabel?: string
}

export const PostShareActionBar: React.FC<PostShareActionBarProps> = ({ shareUrl, backLink, shareLabel = 'Share' }) => {
  const handleShare = React.useCallback(async () => {
    await sharePostUrl(shareUrl)
  }, [shareUrl])

  return <PostActionBar backLink={backLink} shareButton={{ label: shareLabel, onClick: handleShare }} />
}
