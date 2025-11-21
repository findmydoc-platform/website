import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import type { Header } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { MapPin, Mail, Phone, Facebook, Twitter, Github } from 'lucide-react'

export async function Footer() {
  const footerData: FooterType = await getCachedGlobal('footer', 1)()
  const headerData: Header = await getCachedGlobal('header', 1)()

  const footerNavItems = footerData?.navItems || []
  const quickLinks = headerData?.navItems || []

  return (
    <footer className="mt-auto bg-accent text-white">
      <div className="page-shell py-12">
        {/* Main 4-column grid */}
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: Logo + Description */}
          <div className="space-y-4">
            <Logo loading="lazy" priority="low" variant="white" />
            <div className="h-px bg-white/20" />
            <p className="text-sm leading-relaxed text-white/80">
              Findmydoc is an editorial platform focused on comparison and education in the field of cosmetic surgery in
              Turkey.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h5 className="mb-4 text-lg font-semibold">Quick Links</h5>
            <nav className="flex flex-col gap-2">
              {quickLinks.map(({ link }, i) => (
                <CMSLink key={i} {...link} className="text-sm text-white/80 transition-colors hover:text-white" />
              ))}
            </nav>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h5 className="mb-4 text-lg font-semibold">Contact</h5>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
                <span className="text-white/80">Sample Street 1, 10115 Berlin</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-white/60" />
                <a href="mailto:contact@example.com" className="text-white/80 transition-colors hover:text-white">
                  contact@example.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-white/60" />
                <a href="tel:+493012345678" className="text-white/80 transition-colors hover:text-white">
                  +49 30 1234 5678
                </a>
              </div>
            </div>
          </div>

          {/* Column 4: Social Media */}
          <div>
            <h5 className="mb-4 text-lg font-semibold">Follow us:</h5>
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://github.com/findmydoc-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary transition-colors hover:bg-primary/80"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom section: Copyright + Legal */}
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
      </div>
    </footer>
  )
}
