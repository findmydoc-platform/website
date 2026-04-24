import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { UiLink } from '@/components/molecules/Link'
import { Logo } from '@/components/molecules/Logo/Logo'
import { SocialLink } from '@/components/molecules/SocialLink'
import type { FooterNavGroup } from '@/utilities/normalizeNavItems'

export type FooterProps = {
  footerGroups: FooterNavGroup[]
  logoSrc?: string
  showPreviewBadge?: boolean
}

export const Footer: React.FC<FooterProps> = ({ footerGroups, logoSrc, showPreviewBadge = false }) => (
  <footer className="mt-auto border-t border-border/60 bg-background text-foreground">
    <Container className="py-10 sm:py-12">
      <div className="flex flex-col gap-10 sm:gap-12">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-start md:justify-between md:gap-16">
          <Logo loading="lazy" priority="low" src={logoSrc} showPreviewBadge={showPreviewBadge} />

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
            <SocialLink href="https://instagram.com" aria-label="Instagram" platform="instagram" variant="outline" />
          </div>
        </div>
      </div>
    </Container>
  </footer>
)
