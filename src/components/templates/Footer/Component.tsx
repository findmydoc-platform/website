import React from 'react'

import { UiLink, type UiLinkProps } from '@/components/molecules/Link'
import { Logo } from '@/components/molecules/Logo/Logo'
import { Facebook, Twitter, Instagram } from 'lucide-react'
import { Container } from '@/components/molecules/Container'

const socialIconClasses =
  'flex h-8 w-8 items-center justify-center rounded-full border border-foreground text-foreground transition-colors hover:bg-primary/5'

type SocialIconProps = {
  href: string
  label: string
  children: React.ReactNode
}

const SocialIcon: React.FC<SocialIconProps> = ({ href, label, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={socialIconClasses} aria-label={label}>
    {children}
  </a>
)

export type FooterProps = {
  footerNavItems: UiLinkProps[]
  headerNavItems: UiLinkProps[]
}

export const Footer: React.FC<FooterProps> = ({ footerNavItems, headerNavItems }) => {
  return (
    <footer className="mt-auto bg-background text-foreground">
      <Container className="py-12">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between md:gap-40">
            <Logo loading="lazy" priority="low" />

            <nav aria-label="Footer primary" className="w-full md:flex-1">
              <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-x-6">
                <div className="flex flex-col items-start gap-6 pt-6 pl-1.5 md:flex-1 md:basis-0">
                  <h4 className="font-bold text-lg text-foreground">About</h4>
                  <ul className="space-y-6">
                    {headerNavItems.slice(0, 3).map((link, index) => (
                      <li key={index}>
                        <UiLink {...link} variant="footer" />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col items-start gap-6 pt-6 pl-1.5 md:flex-1 md:basis-0">
                  <h4 className="font-bold text-lg text-foreground">Service</h4>
                  <ul className="space-y-6">
                    {headerNavItems.slice(3, 6).map((link, index) => (
                      <li key={index}>
                        <UiLink {...link} variant="footer" />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col items-start gap-6 pt-6 pl-1.5 md:flex-1 md:basis-0">
                  <h4 className="font-bold text-lg text-foreground">Information</h4>
                  <ul className="space-y-6">
                    {footerNavItems.slice(0, 3).map((link, index) => (
                      <li key={index}>
                        <UiLink {...link} variant="footer" />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-4 pt-6 text-center">
            <p className="text-normal text-secondary-foreground">
              © Copyright {new Date().getFullYear()}. findmydoc All Rights Reserved
            </p>

            <div className="flex items-center gap-4">
              <SocialIcon href="https://facebook.com" label="Facebook">
                <Facebook className="h-4 w-4" />
              </SocialIcon>
              <SocialIcon href="https://twitter.com" label="Twitter">
                <Twitter className="h-4 w-4" />
              </SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">
                <Instagram className="h-4 w-4" />
              </SocialIcon>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
