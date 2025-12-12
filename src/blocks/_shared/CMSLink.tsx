import React from 'react'

import type { Page, Post } from '@/payload-types'
import { UiLink, type UiLinkProps } from '@/components/molecules/Link'

export type CMSLinkType = {
  appearance?: UiLinkProps['appearance']
  children?: UiLinkProps['children']
  className?: UiLinkProps['className']
  label?: UiLinkProps['label']
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'posts'
    value: Page | Post | string | number
  } | null
  size?: UiLinkProps['size']
  type?: 'custom' | 'reference' | null
  url?: string | null
  variant?: UiLinkProps['variant']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
    variant = 'default',
  } = props

  let href: string | undefined

  if (type === 'reference' && isRecord(reference?.value)) {
    const slug = reference?.value?.['slug']
    if (typeof slug === 'string' && slug.length > 0) {
      href = `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${slug}`
    }
  }

  if (!href && typeof url === 'string' && url.length > 0) {
    href = url
  }

  if (!href) return null

  return (
    <UiLink
      href={href}
      appearance={appearance}
      className={className}
      label={label}
      newTab={!!newTab}
      size={sizeFromProps}
      variant={variant}
    >
      {children}
    </UiLink>
  )
}

export default CMSLink
