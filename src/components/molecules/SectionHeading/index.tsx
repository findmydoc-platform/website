import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/utilities/ui'

const sectionHeadingVariants = cva('flex w-full flex-col gap-6', {
  variants: {
    align: {
      center: 'text-center',
      left: 'text-left',
    },
    size: {
      section: '',
      hero: '',
    },
    tone: {
      default: '',
      accent: '',
    },
  },
  defaultVariants: {
    align: 'center',
    size: 'section',
    tone: 'default',
  },
})

const titleVariants = cva('font-bold tracking-tight', {
  variants: {
    size: {
      section: 'text-3xl sm:text-4xl md:text-5xl',
      hero: 'text-4xl leading-tight sm:text-5xl md:text-7xl',
    },
    tone: {
      default: 'text-foreground',
      accent: 'text-accent-foreground',
    },
  },
  defaultVariants: {
    size: 'section',
    tone: 'default',
  },
})

const descriptionVariants = cva('', {
  variants: {
    size: {
      section: 'text-base text-foreground/80 sm:text-lg md:text-xl',
      hero: 'text-base text-foreground/80 sm:text-lg md:text-2xl',
    },
    tone: {
      default: '',
      accent: 'text-accent-foreground/80',
    },
  },
  defaultVariants: {
    size: 'section',
    tone: 'default',
  },
})

export type SectionHeadingProps = {
  title: string
  description: string
  titleId?: string
  headingAs?: 'h1' | 'h2' | 'h3'
  className?: string
  titleClassName?: string
  descriptionClassName?: string
} & VariantProps<typeof sectionHeadingVariants>

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  description,
  titleId,
  headingAs,
  className,
  titleClassName,
  descriptionClassName,
  align,
  size,
  tone,
}) => {
  const HeadingTag = headingAs ?? (size === 'hero' ? 'h1' : 'h2')

  return (
    <header className={cn(sectionHeadingVariants({ align, size, tone }), className)}>
      <HeadingTag id={titleId} className={cn(titleVariants({ size, tone }), titleClassName)}>
        {title}
      </HeadingTag>
      <p
        className={cn(
          descriptionVariants({ size, tone }),
          align === 'center' ? 'mx-auto max-w-3xl text-balance' : 'max-w-3xl text-pretty',
          descriptionClassName,
        )}
      >
        {description}
      </p>
    </header>
  )
}
