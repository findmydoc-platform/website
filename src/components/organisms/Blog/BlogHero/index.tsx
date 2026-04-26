import React from 'react'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type BlogHeroProps = {
  title?: string
  subtitle?: string
  className?: string
}

/**
 * BlogHero Component
 *
 * Hero banner for blog listing page with gradient background and decorative elements.
 * Features:
 * - Solid primary gradient background (no image)
 * - Decorative semi-transparent circles for visual interest
 * - Centered heading + subtitle
 * - Responsive padding
 *
 * Used on: Blog listing page (/posts)
 */
export const BlogHero: React.FC<BlogHeroProps> = ({
  title = 'Our Blog',
  subtitle = 'Expert insights, practical guidance, and the latest updates in health and medicine.',
  className,
}) => {
  return (
    <section className={cn('relative overflow-hidden', className)}>
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary-hover" />

      {/* Decorative Circles */}
      <div
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/5 md:-top-32 md:-right-32 md:h-96 md:w-96"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-36 -left-36 h-[420px] w-[420px] rounded-full bg-white/5 md:-bottom-48 md:-left-48 md:h-[600px] md:w-[600px]"
        aria-hidden="true"
      />

      {/* Content */}
      <Container className="relative z-10 py-14 text-center md:py-20 lg:py-28">
        <Heading
          as="h1"
          size="h1"
          align="center"
          variant="white"
          className="mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
        >
          {title}
        </Heading>
        {subtitle && (
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/80 sm:text-base md:max-w-2xl md:text-lg">
            {subtitle}
          </p>
        )}
      </Container>
    </section>
  )
}

export default BlogHero
