'use client'
import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from './Nav'
import { Container } from '@/components/molecules/Container'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'

interface HeaderProps {
  navItems: HeaderNavItem[]
  logoSrc?: string
}

export const Header: React.FC<HeaderProps> = ({ navItems, logoSrc }) => (
  <header className="relative bg-white">
    <Container className="flex items-center justify-between py-4">
      <Link href="/">
        <Logo loading="eager" priority="high" className="h-14" src={logoSrc} />
      </Link>
      <HeaderNav navItems={navItems} />
    </Container>
  </header>
)
