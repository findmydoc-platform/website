import React from 'react'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type CallToActionVariant = 'default' | 'spotlight'

export type CallToActionProps = {
  links?: UiLinkProps[]
  richText?: React.ReactNode
  className?: string
  variant?: CallToActionVariant
}

export const CallToAction: React.FC<CallToActionProps> = ({ links, richText, className, variant = 'default' }) => {
  const cardClassName =
    variant === 'spotlight'
      ? 'relative overflow-hidden rounded-[20px] bg-accent px-8 py-16 md:px-16 md:py-24'
      : 'flex flex-col gap-8 rounded-sm border border-border bg-card p-4 md:flex-row md:items-center md:justify-between'

  const contentClassName =
    variant === 'spotlight'
      ? 'flex flex-col items-center justify-between gap-8 md:flex-row'
      : 'flex max-w-3xl items-center'

  const linksWrapperClassName = variant === 'spotlight' ? 'flex flex-col items-center gap-4' : 'flex flex-col gap-8'

  return (
    <Container className={className}>
      <div className={cn(cardClassName)}>
        <div className={cn(contentClassName)}>
          {variant === 'spotlight' ? <div className="max-w-2xl">{richText}</div> : richText && <div>{richText}</div>}
          <div className={cn(linksWrapperClassName)}>
            {(links || []).map((link, i) => (
              <UiLink key={i} size="lg" {...link} />
            ))}
          </div>
        </div>
      </div>
    </Container>
  )
}
