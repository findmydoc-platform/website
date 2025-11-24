'use client'

import React from 'react'
import type { Header as HeaderType } from '@/payload-types'
import { CMSLink } from '@/components/Link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex items-center gap-6">
      {navItems.map(({ link }, i) => {
        return (
          <CMSLink key={i} {...link} className="font-medium text-foreground transition-colors hover:text-primary" />
        )
      })}
    </nav>
  )
}
