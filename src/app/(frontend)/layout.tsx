import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { DM_Sans } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/organisms/AdminBar'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import { Providers } from '@/providers'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { normalizeNavItems, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const footerData: FooterType = await getCachedGlobal('footer', 1)()
  const headerData: HeaderType = await getCachedGlobal('header', 1)()

  const footerNavItems = normalizeNavItems(footerData)
  const footerHeaderNavItems = normalizeNavItems(headerData)
  const headerNavItems = normalizeHeaderNavItems(headerData)

  return (
    <html className={cn(dmSans.variable)} lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <AdminBar adminBarProps={{ preview: isEnabled }} />

          {/* Header: Full-width */}
          <div className="full-width">
            <Header navItems={headerNavItems} />
          </div>

          {/* Content-Area: Full width, pages handle containment */}
          <main className="flex-1">{children}</main>

          {/* Footer: Full-width */}
          <div className="full-width">
            <Footer footerNavItems={footerNavItems} headerNavItems={footerHeaderNavItems} />
          </div>
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
