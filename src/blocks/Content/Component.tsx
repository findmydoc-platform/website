import React from 'react'
import type { ContentBlock as ContentBlockProps } from '@/payload-types'
import { Content } from '@/components/organisms/Content'

export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props

  return <Content columns={columns || undefined} />
}
