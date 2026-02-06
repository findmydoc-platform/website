import React from 'react'
import Link from 'next/link'
import { cn } from '@/utilities/ui'

export type BreadcrumbItem = {
  label: string
  href: string
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
    light: 'text-white/80',
  }

  const hoverClasses = {
    default: 'hover:text-foreground',
    light: 'hover:text-white',
  }

  return (
    <nav className={cn('text-sm', variantClasses[variant], className)} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">{separator}</span>}
            <Link
              href={item.href}
              className={cn('transition-colors', hoverClasses[variant])}
              {...(index === items.length - 1 && { 'aria-current': 'page' })}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}
