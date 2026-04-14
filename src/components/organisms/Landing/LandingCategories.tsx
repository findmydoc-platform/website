import React from 'react'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

import { LandingCategoriesShell } from './LandingCategoriesShell'
import { buildCategoryTabs, type LandingCategoriesProps, withSpecialtyQuery } from './LandingCategories.shared'

export type { LandingCategory, LandingCategoriesProps, LandingCategoryItem } from './LandingCategories.shared'

export function LandingCategories({
  title,
  description,
  categories,
  items,
  featuredIds,
  defaultActiveFilter,
  moreCategoriesLink,
}: LandingCategoriesProps) {
  const baseHref = moreCategoriesLink?.href ?? '/listing-comparison'
  const categoryLabelMap = new Map(buildCategoryTabs(categories).map((category) => [category.value, category.label]))

  const shellItems = items.map((item) => ({
    id: item.id,
    categories: item.categories,
    card: (
      <LandingCategoryCard
        key={item.id}
        label={categoryLabelMap.get(item.categories[0] ?? '') ?? item.categories[0] ?? 'Category'}
        title={item.title}
        subtitle={item.subtitle}
        href={item.href ?? withSpecialtyQuery(baseHref, item.id)}
        newTab={item.newTab}
        image={item.image}
      />
    ),
  }))

  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <header className="mb-12 flex flex-col items-center gap-6 border-b border-border/60 pb-6 text-center">
          <SectionHeading
            title={title}
            description={description}
            size="section"
            align="center"
            titleClassName="font-semibold"
          />
        </header>

        <LandingCategoriesShell
          baseHref={baseHref}
          categories={categories}
          defaultActiveFilter={defaultActiveFilter}
          featuredIds={featuredIds}
          items={shellItems}
          moreCategoriesLink={moreCategoriesLink}
        />
      </Container>
    </section>
  )
}

type LandingCategoryCardProps = {
  href?: string
  image: LandingCategoriesProps['items'][number]['image']
  label: string
  newTab?: boolean
  subtitle?: string | null
  title: string
}

const LandingCategoryCard: React.FC<LandingCategoryCardProps> = ({ href, image, label, newTab, subtitle, title }) => {
  return (
    <div className="group relative h-full w-full overflow-hidden">
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes="(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-60" />
      <div className="absolute bottom-0 left-0 w-full p-6 text-left text-white md:p-8">
        <div className="translate-y-2 transition-all duration-500 group-hover:translate-y-0">
          <p className="text-xs font-bold tracking-widest text-white/80 uppercase">{label}</p>
          <Heading as="h3" size="h5" align="left" className="mt-2 text-2xl font-semibold text-white md:text-2xl">
            {title}
          </Heading>
          <p className="mt-2 max-h-0 overflow-hidden text-sm text-white/90 opacity-0 transition-all duration-500 group-hover:max-h-20 group-hover:opacity-100">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="absolute top-6 right-6 translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-foreground shadow-lg">
          <ArrowRight className="h-4 w-4 -rotate-45" />
        </div>
      </div>
      {href ? (
        <UiLink
          href={href}
          newTab={newTab}
          className={cn(
            'absolute inset-0 z-20 block rounded-2xl',
            'cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
          )}
        >
          <span className="sr-only">Explore {title}</span>
        </UiLink>
      ) : null}
    </div>
  )
}
