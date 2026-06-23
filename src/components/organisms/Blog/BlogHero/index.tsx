import React from 'react'
import { Heading } from '@/components/atoms/Heading'
import { Breadcrumb, type BreadcrumbItem } from '@/components/molecules/Breadcrumb'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type BlogHeroProps = {
  title?: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  className?: string
}

/**
 * BlogHero Component
 *
 * Hero banner for blog listing page with a calm clinic interior photo.
 * Features:
 * - Compact editorial title area
 * - Washed photo background kept secondary behind the copy
 * - Centered narrow copy with a left-anchored desktop copy block
 *
 * Used on: Blog listing page (/posts)
 */
export const BlogHero: React.FC<BlogHeroProps> = ({
  title = 'Our Blog',
  subtitle = 'Expert insights, practical guidance, and the latest updates in health and medicine.',
  breadcrumbs,
  className,
}) => {
  return (
    <>
      {breadcrumbs?.length ? (
        <div className="border-b border-black/5 bg-[#fbf8f4]">
          <Container className="py-4 sm:py-5">
            <Breadcrumb
              items={breadcrumbs}
              className="text-xs sm:text-sm [&_ol]:justify-center lg:[&_ol]:justify-start"
            />
          </Container>
        </div>
      ) : null}

      <section
        className={cn(
          'relative isolate overflow-hidden bg-[#fbf8f4] bg-[url(/images/blog-header-clinic-reception.webp)] bg-cover bg-center bg-no-repeat',
          className,
        )}
      >
        <div className="absolute inset-0 z-0 bg-white/70" aria-hidden="true" />

        {/* Content */}
        <Container className="relative z-10 flex flex-col items-center justify-center py-12 text-center sm:py-14 md:min-h-[20rem] md:py-12 lg:min-h-[22rem] lg:items-start lg:py-14 lg:text-left xl:min-h-[24rem]">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left">
            <Heading as="h1" size="h1" align="center" className="mb-4 text-4xl sm:text-5xl lg:text-left lg:text-6xl">
              {title}
            </Heading>
            {subtitle && (
              <p className="mx-auto max-w-xl text-base leading-relaxed text-foreground/75 sm:text-lg lg:mx-0">
                {subtitle}
              </p>
            )}
          </div>
        </Container>
      </section>
    </>
  )
}

export default BlogHero
