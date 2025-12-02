import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import type { Header } from '@/payload-types'

import { FooterContent } from './FooterContent'

export async function Footer() {
  const footerData: FooterType = await getCachedGlobal('footer', 1)()
  const headerData: Header = await getCachedGlobal('header', 1)()

  return <FooterContent footerData={footerData} headerData={headerData} />
}
