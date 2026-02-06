'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/utilities/ui'
import { UiLink } from '@/components/molecules/Link'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/atoms/accordion'

/* ------------------------------------------------------------------ */
/*  Desktop dropdown for a single nav item with subItems              */
/* ------------------------------------------------------------------ */

const DesktopDropdown: React.FC<{
  item: HeaderNavItem
  open: boolean
  onOpen: () => void
  onClose: () => void
}> = ({ item, open, onOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="flex items-center gap-1 font-bold text-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => (open ? onClose() : onOpen())}
      >
        {item.label}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-2 min-w-48 rounded-lg border border-border bg-white p-2 shadow-md"
          role="menu"
        >
          {item.subItems?.map((sub, idx) => {
            const newTabProps = sub.newTab ? { rel: 'noopener noreferrer' as const, target: '_blank' as const } : {}
            return (
              <Link
                key={idx}
                href={sub.href}
                role="menuitem"
                className="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                onClick={onClose}
                {...newTabProps}
              >
                {sub.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile menu (slide-down panel with accordion sub-items)           */
/* ------------------------------------------------------------------ */

const MobileMenu: React.FC<{
  navItems: HeaderNavItem[]
  open: boolean
  onClose: () => void
}> = ({ navItems, open, onClose }) => {
  if (!open) return null

  return (
    <nav
      className="absolute inset-x-0 top-full z-40 border-t border-border bg-white shadow-md md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex flex-col px-4 py-2">
        {navItems.map((item, idx) => {
          if (item.subItems && item.subItems.length > 0) {
            return (
              <Accordion key={idx} type="single" collapsible>
                <AccordionItem value={`mobile-${idx}`} className="border-b-0">
                  <AccordionTrigger className="py-3 font-bold text-foreground hover:text-primary hover:no-underline">
                    {item.label}
                  </AccordionTrigger>
                  <AccordionContent className="border-t-0 pt-0 pb-2">
                    <div className="flex flex-col gap-1 pl-4">
                      {item.subItems.map((sub, subIdx) => {
                        const newTabProps = sub.newTab
                          ? { rel: 'noopener noreferrer' as const, target: '_blank' as const }
                          : {}
                        return (
                          <Link
                            key={subIdx}
                            href={sub.href}
                            className="rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-primary"
                            onClick={onClose}
                            {...newTabProps}
                          >
                            {sub.label}
                          </Link>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          }

          return (
            <UiLink
              key={idx}
              href={item.href}
              label={item.label}
              newTab={item.newTab}
              className="block py-3 font-bold text-foreground transition-colors hover:text-primary"
              appearance="inline"
            />
          )
        })}
      </div>
    </nav>
  )
}

/* ------------------------------------------------------------------ */
/*  HeaderNav — main export                                           */
/* ------------------------------------------------------------------ */

export const HeaderNav: React.FC<{ navItems: HeaderNavItem[] }> = ({ navItems }) => {
  const items = navItems || []
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (openIndex === null) return
    const handleClick = () => setOpenIndex(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openIndex])

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-4 md:flex md:gap-6" aria-label="Main navigation">
        {items.map((item, i) => {
          if (item.subItems && item.subItems.length > 0) {
            return (
              <DesktopDropdown
                key={i}
                item={item}
                open={openIndex === i}
                onOpen={() => setOpenIndex(i)}
                onClose={() => setOpenIndex(null)}
              />
            )
          }

          return (
            <UiLink
              key={i}
              href={item.href}
              label={item.label}
              newTab={item.newTab}
              appearance="inline"
              className="font-bold text-foreground transition-colors hover:text-primary"
            />
          )
        })}
      </nav>

      {/* Mobile hamburger toggle */}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:hidden"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Mobile panel */}
      <MobileMenu navItems={items} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  )
}
