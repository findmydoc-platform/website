import type { Access, CollectionBeforeOperationHook } from 'payload'

import { isPlatformStaff } from '@/access/isPlatformStaff'
import { platformOnlyOrPublished } from '@/access/scopeFilters'

export const readLocalizedPublicationAccess: Access = async ({ req }) => {
  const access = await platformOnlyOrPublished({ req })
  return req.locale === 'all' && access !== true ? false : access
}

export const constrainPublicLocalizedRead: CollectionBeforeOperationHook = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation === 'read' && !overrideAccess && !(await isPlatformStaff({ req }))) {
    args.draft = false
    req.fallbackLocale = false
    if ('id' in args) {
      args.flattenLocales = true
    }
  }
  return args
}
