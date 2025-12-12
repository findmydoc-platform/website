import React from 'react'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Container } from '@/components/molecules/Container'

export type CallToActionProps = {
  links?: UiLinkProps[]
  richText?: React.ReactNode
  className?: string
}

export const CallToAction: React.FC<CallToActionProps> = ({ links, richText, className }) => {
  return (
    <Container className={className}>
      <div className="flex flex-col gap-8 rounded-sm border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-3xl items-center">{richText}</div>
        <div className="flex flex-col gap-8">
          {(links || []).map((link, i) => (
            <UiLink key={i} size="lg" {...link} />
          ))}
        </div>
      </div>
    </Container>
  )
}
