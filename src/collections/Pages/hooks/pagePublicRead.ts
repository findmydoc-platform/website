import type { Access, CollectionBeforeOperationHook } from 'payload'

import { isPlatformStaff } from '@/access/isPlatformStaff'
import { platformOnlyOrPublished } from '@/access/scopeFilters'

export const readPageAccess: Access = async ({ req }) => {
  const access = await platformOnlyOrPublished({ req })
  return req.locale === 'all' && access !== true ? false : access
}

export const constrainPublicPageRead: CollectionBeforeOperationHook<'pages'> = async ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation === 'read' && !overrideAccess && !(await isPlatformStaff({ req }))) {
    args.draft = false
    req.fallbackLocale = false
  }
  return args
}
