'use client'

import React from 'react'
import { UiLink, type UiLinkProps } from '@/components/molecules/Link'

export const HeaderNav: React.FC<{ navItems: UiLinkProps[] }> = ({ navItems }) => {
  const items = navItems || []

  return (
    <nav className="flex flex-wrap items-center gap-4 md:gap-6">
      {items.map((link, i) => {
        return <UiLink key={i} {...link} className="text-foreground hover:text-primary font-bold transition-colors" />
      })}
    </nav>
  )
}
