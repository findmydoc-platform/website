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
import { Container } from '@/components/molecules/Container'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html className={cn(dmSans.variable)} lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>
          <AdminBar adminBarProps={{ preview: isEnabled }} />

          {/* Header: Full-bleed */}
          <div className="full-bleed">
            <Header />
          </div>

          {/* Content-Area: centralized Container with max-width */}
          <Container className="my-12" asChild>
            <main>{children}</main>
          </Container>

          {/* Footer: Full-bleed */}
          <div className="full-bleed">

            <Footer />
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
