import React from 'react'

import type { Footer as FooterType, Header } from '@/payload-types'

import { CMSLink } from '@/components/molecules/Link'
import { Logo } from '@/components/molecules/Logo/Logo'
import { MapPin, Mail, Phone, Facebook, Twitter, Github } from 'lucide-react'
import { Container } from '@/components/molecules/Container'

const socialIconClasses =
  'flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80'

export type FooterContentProps = {
  footerData: FooterType
  headerData: Header
}

export const FooterContent: React.FC<FooterContentProps> = ({ footerData, headerData }) => {
  const footerNavItems = footerData?.navItems || []
  const quickLinks = headerData?.navItems || []

  return (
    <footer className="mt-auto bg-accent text-white">
      <Container className="py-12">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Logo loading="lazy" priority="low" variant="white" />
            <div className="h-px bg-white/20" />
            <p className="text-sm leading-relaxed text-white/80">
              Findmydoc is an editorial platform focused on comparison and education in the field of cosmetic surgery in
              Turkey.
            </p>
          </div>

          <div>
            <h5 className="mb-4 text-lg font-semibold">Quick Links</h5>
            <nav className="flex flex-col gap-2">
              {quickLinks.map(({ link }, i) => (
                <CMSLink key={i} {...link} className="text-sm text-white/80 transition-colors hover:text-white" />
              ))}
            </nav>
          </div>

          <div>
            <h5 className="mb-4 text-lg font-semibold">Contact</h5>
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex items-start gap-4">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
                <span className="text-white/80">Sample Street 1, 10115 Berlin</span>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="h-4 w-4 shrink-0 text-white/60" />
                <a href="mailto:contact@example.com" className="text-white/80 transition-colors hover:text-white">
                  contact@example.com
                </a>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="h-4 w-4 shrink-0 text-white/60" />
                <a href="tel:+493012345678" className="text-white/80 transition-colors hover:text-white">
                  +49 30 1234 5678
                </a>
              </div>
            </div>
          </div>

          <div>
            <h5 className="mb-4 text-lg font-semibold">Follow us:</h5>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialIconClasses}
                aria-label="Facebook"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialIconClasses}
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="https://github.com/findmydoc-platform"
                target="_blank"
                rel="noopener noreferrer"
                className={socialIconClasses}
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 pt-6">
          <div className="flex flex-col gap-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
            <p>Copyright © {new Date().getFullYear()} findmydoc</p>
            <div className="flex gap-4">
              {footerNavItems.map(({ link }, i) => (
                <CMSLink key={i} {...link} className="text-white/60 transition-colors hover:text-white" />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </footer>
  )
}
