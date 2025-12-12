'use client'
import Link from 'next/link'
import React from 'react'

import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from './Nav'
import { Container } from '@/components/molecules/Container'
import type { UiLinkProps } from '@/components/molecules/Link'

interface HeaderProps {
  navItems: UiLinkProps[]
}

export const Header: React.FC<HeaderProps> = ({ navItems }) => {
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
