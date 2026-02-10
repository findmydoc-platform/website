'use client'

import { Pagination, type PaginationProps } from '@/components/molecules/Pagination'
import { useRouter } from 'next/navigation'
import React from 'react'

type Props = Omit<PaginationProps, 'onNavigate'>

export const PostsPagination: React.FC<Props> = (props) => {
  const router = useRouter()

  return <Pagination {...props} onNavigate={router.push} />
}
