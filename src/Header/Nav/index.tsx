'use client'

import React from 'react'

import type { Header as HeaderType } from '@/payload-types'

import { CMSLink } from '@/components/Link'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex gap-6 items-center">
      {navItems.map(({ link }, i) => {
        const isLast = i === navItems.length - 1
        
        return (
          <CMSLink
            key={i}
            {...link}
            className={isLast 
              ? 'bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 transition-colors font-medium'
              : 'text-foreground hover:text-primary transition-colors font-medium'
            }
          />
        )
      })}
    </nav>
  )
}
