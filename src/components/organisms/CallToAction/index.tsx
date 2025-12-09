import React from 'react'

import type { CallToActionBlock } from '@/payload-types'

import RichText from '@/components/organisms/RichText'
import { CMSLink } from '@/components/molecules/Link'
import { Container } from '@/components/molecules/Container'

export type CallToActionProps = {
  links?: CallToActionBlock['links']
  richText?: CallToActionBlock['richText']
  className?: string
}

export const CallToAction: React.FC<CallToActionProps> = ({ links, richText, className }) => {
  return (
    <Container className={className}>
      <div className="flex flex-col gap-8 rounded-sm border border-border bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-3xl items-center">
          {richText && <RichText className="mb-0" data={richText} enableGutter={false} />}
        </div>
        <div className="flex flex-col gap-8">
          {(links || []).map(({ link }, i) => {
            return <CMSLink key={i} size="lg" {...link} />
          })}
        </div>
      </div>
    </Container>
  )
}
