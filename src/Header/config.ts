import type { GlobalConfig } from 'payload'

import { navItemsField } from '@/fields/navItems'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  fields: [navItemsField()],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
