import React from 'react'

import type { Page, Post } from '@/payload-types'
import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { resolveHrefFromCMSLink } from './utils'

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

  const href = resolveHrefFromCMSLink({ type, url, reference })

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
