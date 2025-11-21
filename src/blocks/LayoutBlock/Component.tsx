import type { LayoutBlock as LayoutBlockProps, Page } from '@/payload-types'
import React from 'react'
import { cn } from '@/utilities/ui'
import { RenderBlocks as Blocks } from '@/blocks/RenderBlocks'

type Props = {
  className?: string
  accent?: 'none' | 'left' | 'right'
} & LayoutBlockProps

export const LayoutBlock: React.FC<Props> = ({ background, width, accent = 'none', content, className }) => {
  const bg = background ?? 'primary'

  const backgroundClasses = {
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    accent: 'bg-accent',
    'accent-2': 'bg-accent-2',
  }[bg]

  const widthClasses = {
    full: 'w-full',
    'two-thirds': 'w-full lg:w-8/12',
    half: 'w-full lg:w-6/12',
    third: 'w-full lg:w-4/12',
  }[width ?? 'full']

  const paddingByWidth = {
    full: 'p-16 lg:p-20',
    'two-thirds': 'p-12 lg:p-16',
    half: 'p-10 lg:p-12',
    third: 'p-8 lg:p-10',
  }[width ?? 'full']

  const roundedClasses = {
    none: 'rounded-4xl',
    left: 'rounded-tr-4xl rounded-tl-4xl rounded-br-4xl',
    right: 'rounded-tr-4xl rounded-tl-4xl rounded-bl-4xl',
  }[accent]

  return (
    <section className={cn('full-bleed', className)}>
      <div className="page-shell">
        <div className={cn(backgroundClasses, widthClasses, paddingByWidth, roundedClasses, 'mx-auto overflow-hidden')}>
          <Blocks blocks={(content ?? []) as Page['layout']} />
        </div>
      </div>
    </section>
  )
}
