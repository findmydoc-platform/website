'use client'
import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from './Nav'
import { Container } from '@/components/molecules/Container'
import type { UiLinkProps } from '@/components/molecules/Link'

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function resolveHrefFromCMSLink(link: {
  type?: 'custom' | 'reference' | null
  url?: string | null
  reference?: unknown
}): string | undefined {
  if (link.type === 'reference' && isRecord(link.reference)) {
    const relationTo = link.reference['relationTo']
    const value = link.reference['value']

    if (typeof relationTo === 'string' && isRecord(value)) {
      const slug = value['slug']
      if (typeof slug === 'string' && slug.length > 0) {
        return `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug}`
      }
    }
  }

  if (typeof link.url === 'string' && link.url.length > 0) return link.url

  return undefined
}

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const navItems = (data?.navItems ?? [])
    .map((item) => {
      const link = item?.link
      const href = link ? resolveHrefFromCMSLink(link) : undefined
      if (!href) return null

      return {
        href,
        label: link?.label ?? null,
        newTab: !!link?.newTab,
        appearance: 'inline',
      } satisfies UiLinkProps
    })
    .filter(isNotNull)

  return (
    <header className="bg-white">
      <Container className="flex items-center justify-between py-4">
        <Link href="/">
          <Logo loading="eager" priority="high" className="h-14" />
        </Link>
        <HeaderNav navItems={navItems} />
      </Container>
    </header>
  )
}
