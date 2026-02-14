import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'
import { Logo } from '@/components/molecules/Logo/Logo'
import { Container } from '@/components/molecules/Container'
import { SocialLink } from '@/components/molecules/SocialLink'
import type { FooterNavGroup } from '@/utilities/normalizeNavItems'

export type FooterProps = {
  footerGroups: FooterNavGroup[]
}

export const Footer: React.FC<FooterProps> = ({ footerGroups }) => {
  return (
    <footer className="mt-auto bg-background text-foreground">
      <Container className="py-12">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between md:gap-40">
            <Logo loading="lazy" priority="low" />

            <nav aria-label="Footer primary" className="w-full md:flex-1">
              <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-x-6">
                {footerGroups.map((group) => (
                  <div key={group.title} className="flex flex-col items-start gap-6 pt-6 pl-1.5 md:flex-1 md:basis-0">
                    <Heading as="h4" size="h6" align="left" className="text-lg text-foreground">
                      {group.title}
                    </Heading>
                    <ul className="space-y-6">
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

          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <p className="text-normal text-muted-foreground">
              © Copyright {new Date().getFullYear()}. findmydoc All Rights Reserved
            </p>

            <div className="flex items-center gap-4">
              <SocialLink href="https://facebook.com" aria-label="Facebook" platform="facebook" variant="outline" />
              <SocialLink href="https://twitter.com" aria-label="Twitter" platform="twitter" variant="outline" />
              <SocialLink href="https://instagram.com" aria-label="Instagram" platform="instagram" variant="outline" />
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
