'use client'
import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from './Nav'
import { Container } from '@/components/molecules/Container'
import type { UiLinkProps } from '@/components/molecules/Link'
import { isNotNull, resolveHrefFromCMSLink } from '@/blocks/_shared/utils'

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
