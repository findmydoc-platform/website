import React from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/atoms/accordion'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'
import { Logo } from '@/components/molecules/Logo/Logo'
import { SocialLink } from '@/components/molecules/SocialLink'
import { LEGACY_LEGAL_REDIRECTS, REQUIRED_LEGAL_FOOTER_LINKS } from '@/utilities/legalPages'
import type { FooterNavGroup } from '@/utilities/normalizeNavItems'

export type FooterProps = {
  footerGroups: FooterNavGroup[]
  logoSrc?: string
  showPreviewBadge?: boolean
}

const legalFooterHrefs = new Set([
  ...REQUIRED_LEGAL_FOOTER_LINKS.map(({ href }) => href),
  ...LEGACY_LEGAL_REDIRECTS.map(({ from }) => from),
])

const footerDescription =
  'Helping patients make clearer clinic decisions. Helping clinics present their strengths responsibly.'

function normalizeFooterHref(href: string): string {
  return href === '/' ? href : href.replace(/\/+$/, '')
}

export const Footer: React.FC<FooterProps> = ({ footerGroups, logoSrc, showPreviewBadge = false }) => {
  const isLegalLink = (href: string) => legalFooterHrefs.has(normalizeFooterHref(href))
  const legalQuickLinks = footerGroups
    .flatMap((group) => group.items)
    .filter((link) => isLegalLink(link.href))
    .filter((link, index, links) => links.findIndex((candidate) => candidate.href === link.href) === index)
  const mobileFooterGroups = footerGroups.map((group) => ({
    ...group,
    items: group.items.filter((link) => !isLegalLink(link.href)),
  }))
  const visibleMobileFooterGroups = mobileFooterGroups.filter((group) => group.items.length > 0)

  return (
    <footer className="mt-auto bg-site-chrome text-foreground">
      <Container className="py-8 sm:py-12">
        <div className="flex flex-col gap-8 sm:gap-12">
          <div className="flex flex-col gap-8 md:hidden">
            <div className="flex flex-col items-start gap-3">
              <Logo loading="lazy" priority="low" src={logoSrc} showPreviewBadge={showPreviewBadge} className="h-10" />
              <p className="max-w-72 text-sm leading-6 text-muted-foreground">{footerDescription}</p>
            </div>

            {visibleMobileFooterGroups.length > 0 ? (
              <Accordion type="multiple" className="rounded-2xl border border-site-divider/70 bg-card">
                {visibleMobileFooterGroups.map((group) => (
                  <AccordionItem key={group.title} value={group.title} className="border-site-divider/70 px-4">
                    <AccordionTrigger className="min-h-11 py-4 text-base font-semibold text-foreground hover:no-underline">
                      {group.title}
                    </AccordionTrigger>
                    <AccordionContent className="border-t-0 pt-0 pb-4">
                      <ul className="space-y-3">
                        {group.items.map((link) => (
                          <li key={`${group.title}-${link.href}-${link.label ?? ''}`}>
                            <UiLink {...link} variant="footer" />
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : null}

            {legalQuickLinks.length > 0 ? (
              <nav aria-label="Footer legal quick links" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {legalQuickLinks.map((link) => (
                  <UiLink key={`legal-${link.href}-${link.label ?? ''}`} {...link} variant="footer" />
                ))}
              </nav>
            ) : null}

            <div className="flex flex-col items-start gap-4 border-t border-site-divider/60 pt-4">
              <div className="flex flex-wrap items-center gap-4">
                <SocialLink href="https://meta.com" aria-label="Meta" platform="meta" variant="outline" />
                <SocialLink href="https://x.com" aria-label="X" platform="x" variant="outline" />
                <SocialLink
                  href="https://instagram.com"
                  aria-label="Instagram"
                  platform="instagram"
                  variant="outline"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                © Copyright {new Date().getFullYear()}. findmydoc All Rights Reserved
              </p>
            </div>
          </div>

          <div className="hidden md:flex md:flex-col md:gap-12">
            <div className="flex flex-col items-start gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
              <div className="flex max-w-80 flex-col items-start gap-4">
                <Logo
                  loading="lazy"
                  priority="low"
                  src={logoSrc}
                  showPreviewBadge={showPreviewBadge}
                  className="h-11"
                />
                <p className="max-w-72 text-sm leading-6 text-muted-foreground">{footerDescription}</p>
              </div>

              <nav aria-label="Footer primary" className="w-full md:flex-1">
                <div className="flex flex-col gap-8 sm:gap-10 md:flex-row md:items-start md:justify-between md:gap-x-6">
                  {footerGroups.map((group) => (
                    <div key={group.title} className="flex flex-col items-start gap-4 pt-0 pl-1.5 md:flex-1 md:basis-0">
                      <Heading as="h4" size="h6" align="left" className="text-lg text-foreground">
                        {group.title}
                      </Heading>
                      <ul className="space-y-4 sm:space-y-5">
                        {group.items.map((link) => (
                          <li key={`${group.title}-${link.href}-${link.label ?? ''}`}>
                            <UiLink {...link} variant="footer" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </nav>
            </div>

            <div className="flex flex-col items-center gap-4 pt-2 text-center sm:pt-6">
              <p className="text-normal text-muted-foreground">
                © Copyright {new Date().getFullYear()}. findmydoc All Rights Reserved
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <SocialLink href="https://meta.com" aria-label="Meta" platform="meta" variant="outline" />
                <SocialLink href="https://x.com" aria-label="X" platform="x" variant="outline" />
                <SocialLink
                  href="https://instagram.com"
                  aria-label="Instagram"
                  platform="instagram"
                  variant="outline"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
