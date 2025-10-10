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
      <div className="container py-12">
        {/* Main 4-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Column 1: Logo + Description */}
          <div className="space-y-4">
            <Logo loading="lazy" priority="low" variant="white" />
            <div className="h-px bg-white/20" />
            <p className="text-sm text-white/80 leading-relaxed">
              Findmydoc ist eine redaktionelle Plattform mit Fokus auf Vergleich und Aufklärung im Bereich
              Schönheitsoperationen in der Türkei.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h5 className="font-semibold text-lg mb-4">Quick Links</h5>
            <nav className="flex flex-col gap-2">
              {quickLinks.map(({ link }, i) => (
                <CMSLink key={i} {...link} className="text-white/80 hover:text-white transition-colors text-sm" />
              ))}
            </nav>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h5 className="font-semibold text-lg mb-4">Kontakt</h5>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-white/60 flex-shrink-0 mt-0.5" />
                <span className="text-white/80">Musterstraße 1, 10115 Berlin</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-white/60 flex-shrink-0" />
                <a href="mailto:kontakt@example.com" className="text-white/80 hover:text-white transition-colors">
                  kontakt@example.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-white/60 flex-shrink-0" />
                <a href="tel:+493012345678" className="text-white/80 hover:text-white transition-colors">
                  +49 30 1234 5678
                </a>
              </div>
            </div>
          </div>

          {/* Column 4: Social Media */}
          <div>
            <h5 className="font-semibold text-lg mb-4">Folge uns auf:</h5>
            <div className="flex gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/80 transition-colors flex items-center justify-center"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/80 transition-colors flex items-center justify-center"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="https://github.com/findmydoc-platform"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/80 transition-colors flex items-center justify-center"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom section: Copyright + Legal */}
        <div className="border-t border-white/20 pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-white/60">
            <p>Copyright © {new Date().getFullYear()} findmydoc</p>
            <div className="flex gap-4">
              {footerNavItems.map(({ link }, i) => (
                <CMSLink key={i} {...link} className="text-white/60 hover:text-white transition-colors" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
