import type { GlobalConfig } from 'payload'

import { navItemsField } from '@/fields/navItems'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [navItemsField()],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
