'use client'

import { Pagination, type PaginationProps } from '@/components/molecules/Pagination'
import { buildPostsPagePath } from '@/utilities/content/postPaths'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'
import { useRouter } from 'next/navigation'
import React from 'react'

type Props = Omit<PaginationProps, 'getPathForPage' | 'onNavigate'> & { contentLocale: ContentLocaleContext }

export const PostsPagination: React.FC<Props> = ({ contentLocale, ...props }) => {
  const router = useRouter()

  return (
    <Pagination
      {...props}
      getPathForPage={(page) => buildPostsPagePath(page, contentLocale)}
      onNavigate={router.push}
    />
  )
}
