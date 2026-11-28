import React from 'react'
import Link from 'next/link'
import { cn } from '@/utilities/ui'

export type BreadcrumbItem = {
  label: string
  href: string
  current?: boolean
  lang?: string
}

export type BreadcrumbProps = {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  label?: string
  variant?: 'default' | 'light'
  className?: string
  lang?: string
}

const breadcrumbColors = {
  default: {
    trail: 'text-supporting-foreground',
    link: 'text-supporting-foreground underline decoration-supporting-foreground/55 decoration-1 underline-offset-4 hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    current: 'text-foreground',
    separator: 'text-inherit',
  },
  light: {
    trail: 'text-white',
    link: '!text-white/60 hover:!text-white/85',
    current: '!text-white',
    separator: '!text-white/45',
  },
}

/**
 * Breadcrumb navigation component
 * Displays a trail of links showing the current page's location in the site hierarchy
 *
 * @example
 * ```tsx
 * <Breadcrumb
 *   items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Blog', href: '/posts' },
 *     { label: 'Category', href: '/posts?category=tech' }
 *   ]}
 * />
 * ```
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '›',
  label = 'Breadcrumb',
  variant = 'default',
  className,
  lang,
}) => {
  if (!items || items.length === 0) {
    return null
  }

  const colors = breadcrumbColors[variant]

  return (
    <nav className={cn('text-sm', colors.trail, className)} aria-label={label} lang={lang}>
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1

          return (
            <li
              key={`${item.href}-${index}`}
              lang={item.lang}
              className="inline-flex max-w-full min-w-0 items-center gap-4"
            >
              {isCurrent ? (
                <span aria-current="page" className={cn('max-w-full break-words', colors.current)} title={item.label}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={cn('max-w-full break-words transition-colors', colors.link)}>
                  {item.label}
                </Link>
              )}
              {index < items.length - 1 && (
                <span aria-hidden="true" className={colors.separator}>
                  {separator}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
