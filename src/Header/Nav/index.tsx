'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex items-center gap-6">
      {navItems.map(({ link }, i) => {
        const isLast = i === navItems.length - 1
        
        return (
          <CMSLink
            key={i}
            {...link}
            className={isLast 
              ? 'rounded-md bg-primary px-6 py-2 font-medium text-white transition-colors hover:bg-primary/90'
              : 'font-medium text-foreground transition-colors hover:text-primary'
            }
          />
        )
      })}
    </nav>
  )
}
