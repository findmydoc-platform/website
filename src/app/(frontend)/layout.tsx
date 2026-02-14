import type { Metadata } from 'next'

import React from 'react'
import '@fontsource/dm-sans'

import { AdminBar } from '@/components/organisms/AdminBar'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import { Providers } from '@/providers'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { normalizeFooterNavGroups, normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import type { Footer as FooterType, Header as HeaderType } from '@/payload-types'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const footerData = (await getCachedGlobal('footer', 1)()) as FooterType
  const headerData = (await getCachedGlobal('header', 1)()) as HeaderType

  const footerGroups = normalizeFooterNavGroups(footerData)
  const headerNavItems = normalizeHeaderNavItems(headerData)

  return (
    <html lang="en" suppressHydrationWarning>
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
            <Footer footerGroups={footerGroups} />
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
