'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/utilities/ui'
import { UiLink } from '@/components/molecules/Link'
import type { HeaderNavItem } from '@/utilities/normalizeNavItems'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/atoms/accordion'
import { useMobileMenuState } from './useMobileMenuState'

const getNavItemKey = (item: HeaderNavItem, index: number): string =>
  item.href ?? `group-${index}-${item.label ?? 'item'}`
const mobileMenuId = 'header-mobile-navigation'

/* ------------------------------------------------------------------ */
/*  Desktop dropdown for a single nav item with subItems              */
/* ------------------------------------------------------------------ */

const DesktopDropdown: React.FC<{
  item: HeaderNavItem
  open: boolean
  onOpen: () => void
  onClose: () => void
  onCloseWithDelay: () => void
}> = ({ item, open, onOpen, onClose, onCloseWithDelay }) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const nextTarget = e.relatedTarget as Node | null
      if (!e.currentTarget.contains(nextTarget)) {
        onClose()
      }
    },
    [onClose],
  )

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onCloseWithDelay}
      onFocus={onOpen}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={cn(
          'flex items-center gap-1 rounded-sm px-1.5 py-1 font-bold text-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden',
          open && 'text-foreground',
        )}
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {item.label}
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 min-w-52 rounded-md border border-site-divider bg-card p-2 shadow-sm">
          <ul className="space-y-1">
            {item.subItems?.map((sub) => {
              const newTabProps = sub.newTab ? { rel: 'noopener noreferrer' as const, target: '_blank' as const } : {}
              return (
                <li key={sub.href}>
                  <Link
                    href={sub.href}
                    className="block rounded-sm px-3 py-2 text-foreground transition-colors hover:bg-site-section hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
                    onClick={onClose}
                    {...newTabProps}
                  >
                    {sub.label}
                  </Link>
                </li>
              )
            })}
          </ul>
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
      id={mobileMenuId}
      className="fixed inset-x-0 top-[var(--site-header-height)] bottom-0 z-[60] border-t border-site-divider/70 bg-site-chrome/98 shadow-lg backdrop-blur lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex h-full flex-col overflow-y-auto overscroll-contain px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {navItems.map((item, index) => {
          const itemKey = getNavItemKey(item, index)

          if (item.subItems && item.subItems.length > 0) {
            return (
              <Accordion key={itemKey} type="single" collapsible>
                <AccordionItem value={`mobile-${itemKey}`} className="border-site-divider/70">
                  <AccordionTrigger className="min-h-11 py-3 text-base font-semibold text-foreground hover:text-foreground hover:no-underline">
                    {item.label}
                  </AccordionTrigger>
                  <AccordionContent className="border-t-0 pt-0 pb-3">
                    <div className="flex flex-col gap-1 pl-4">
                      {item.subItems.map((sub) => {
                        const newTabProps = sub.newTab
                          ? { rel: 'noopener noreferrer' as const, target: '_blank' as const }
                          : {}
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="min-h-11 rounded-sm px-3 py-3 text-sm text-foreground transition-colors hover:bg-site-section hover:text-foreground"
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

          if (!item.href) {
            return (
              <span key={itemKey} className="block min-h-11 py-3 text-base font-semibold text-foreground">
                {item.label}
              </span>
            )
          }

          const newTabProps = item.newTab ? { rel: 'noopener noreferrer' as const, target: '_blank' as const } : {}
          return (
            <Link
              key={itemKey}
              href={item.href}
              onClick={onClose}
              className="block min-h-11 py-3 text-base font-semibold text-foreground transition-colors hover:text-foreground"
              {...newTabProps}
            >
              {item.label}
            </Link>
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
  const hasMobileMenuItems = items.length > 0
  const desktopNavRef = useRef<HTMLElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const closeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const getHeaderLogoLink = useCallback(() => document.querySelector<HTMLAnchorElement>('header a[href="/"]'), [])
  const {
    close: closeMobileMenu,
    isOpen: isMobileMenuOpen,
    toggle: toggleMobileMenu,
  } = useMobileMenuState(hasMobileMenuItems, {
    getFallbackFocusTarget: getHeaderLogoLink,
    menuButtonRef: mobileMenuButtonRef,
  })

  const clearCloseDelay = useCallback(() => {
    if (!closeDelayRef.current) return
    clearTimeout(closeDelayRef.current)
    closeDelayRef.current = null
  }, [])

  const closeDropdown = useCallback(() => {
    clearCloseDelay()
    setOpenIndex(null)
  }, [clearCloseDelay])

  const closeDropdownWithDelay = useCallback(() => {
    clearCloseDelay()
    closeDelayRef.current = setTimeout(() => {
      setOpenIndex(null)
      closeDelayRef.current = null
    }, 180)
  }, [clearCloseDelay])

  const openDropdownAtIndex = useCallback(
    (index: number) => {
      clearCloseDelay()
      setOpenIndex(index)
    },
    [clearCloseDelay],
  )

  useEffect(() => clearCloseDelay, [clearCloseDelay])

  // Close desktop dropdown on outside click
  useEffect(() => {
    if (openIndex === null) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (desktopNavRef.current?.contains(target)) return
      closeDropdown()
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [closeDropdown, openIndex])

  return (
    <>
      {/* Desktop nav */}
      <nav ref={desktopNavRef} className="hidden items-center gap-4 lg:flex lg:gap-6" aria-label="Main navigation">
        {items.map((item, i) => {
          const itemKey = getNavItemKey(item, i)

          if (item.subItems && item.subItems.length > 0) {
            return (
              <DesktopDropdown
                key={itemKey}
                item={item}
                open={openIndex === i}
                onOpen={() => openDropdownAtIndex(i)}
                onClose={closeDropdown}
                onCloseWithDelay={closeDropdownWithDelay}
              />
            )
          }

          if (!item.href) {
            return (
              <span key={itemKey} className="rounded-sm px-1.5 py-1 font-bold text-foreground">
                {item.label}
              </span>
            )
          }

          return (
            <UiLink
              key={itemKey}
              href={item.href}
              label={item.label}
              newTab={item.newTab}
              appearance="inline"
              className="rounded-sm px-1.5 py-1 font-bold text-foreground transition-colors hover:text-foreground"
            />
          )
        })}
      </nav>

      {hasMobileMenuItems ? (
        <button
          ref={mobileMenuButtonRef}
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-site-section hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden lg:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-controls={mobileMenuId}
          aria-expanded={isMobileMenuOpen}
          onClick={toggleMobileMenu}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      ) : null}

      {/* Mobile panel */}
      {hasMobileMenuItems ? <MobileMenu navItems={items} open={isMobileMenuOpen} onClose={closeMobileMenu} /> : null}
    </>
  )
}
