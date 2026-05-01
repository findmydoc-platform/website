import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from './Nav'
import { Container } from '@/components/molecules/Container'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'

interface HeaderProps {
  navItems: HeaderNavItem[]
  logoSrc?: string
  rightActions?: React.ReactNode
  showPreviewBadge?: boolean
}

export const Header: React.FC<HeaderProps> = ({ navItems, logoSrc, rightActions, showPreviewBadge = false }) => (
  <header className="relative z-40 bg-white [--site-header-height:4.5rem] sm:[--site-header-height:5rem]">
    <Container className="flex items-center justify-between gap-3 py-3 sm:py-4">
      <Link href="/" className="shrink-0">
        <Logo
          loading="eager"
          priority="high"
          className="h-11 sm:h-14"
          src={logoSrc}
          showPreviewBadge={showPreviewBadge}
        />
      </Link>
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 [&_button]:shrink-0">
        <HeaderNav navItems={navItems} />
        {rightActions}
      </div>
    </Container>
  </header>
)
