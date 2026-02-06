import React from 'react'
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
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/5" aria-hidden="true" />
      <div className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full bg-white/5" aria-hidden="true" />

      {/* Content */}
      <Container className="relative z-10 py-16 text-center md:py-20 lg:py-28">
        <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl lg:text-6xl">{title}</h1>
        {subtitle && <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">{subtitle}</p>}
      </Container>
    </section>
  )
}

export default BlogHero
