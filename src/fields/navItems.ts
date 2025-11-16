import { Field } from 'payload'
import { link } from '@/fields/link'

/**
 * Shared navItems array field configuration used by Header and Footer globals.
 * Provides a consistent navigation item structure across both.
 */
export const navItemsField = (): Field => ({
  name: 'navItems',
  type: 'array',
  fields: [
    link({
      appearances: false,
    }),
  ],
  maxRows: 6,
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/components/shared/NavItemRowLabel#NavItemRowLabel',
    },
  },
})
