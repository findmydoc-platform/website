import React from 'react'
import Link from 'next/link'
import { cn } from '@/utilities/ui'

export type BreadcrumbItem = {
  label: string
  href: string
  current?: boolean
}

export type BreadcrumbProps = {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  variant?: 'default' | 'light'
  className?: string
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
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, separator = '›', variant = 'default', className }) => {
  if (!items || items.length === 0) {
    return null
  }

  const variantClasses = {
    default: 'text-muted-foreground',
    light: 'text-white',
  }

  return (
    <nav className={cn('text-sm', variantClasses[variant], className)} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((item, index) => {
          const isCurrent = item.current ?? index === items.length - 1

          const itemClasses =
            variant === 'light'
              ? isCurrent
                ? '!text-white hover:!text-white'
                : '!text-white/60 hover:!text-white/85'
              : 'text-inherit hover:text-foreground'

          return (
            <li key={`${item.href}-${index}`} className="inline-flex max-w-full min-w-0 items-center gap-4">
              {isCurrent ? (
                <span aria-current="page" className={cn('max-w-full break-words', itemClasses)} title={item.label}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={cn('max-w-full break-words transition-colors', itemClasses)}>
                  {item.label}
                </Link>
              )}
              {index < items.length - 1 && (
                <span aria-hidden="true" className={cn(variant === 'light' ? '!text-white/45' : 'text-inherit')}>
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
