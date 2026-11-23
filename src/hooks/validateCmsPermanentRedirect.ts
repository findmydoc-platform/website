import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

import type { Redirect } from '@/payload-types'
import { parseCmsRedirectPath } from '@/utilities/content/cmsRedirectPaths'

export const validateCmsPermanentRedirect: CollectionBeforeValidateHook<Redirect> = ({ data, originalDoc }) => {
  if ((data?.type ?? originalDoc?.type) !== '301') return data

  const from = data?.from ?? originalDoc?.from
  const destination = { ...originalDoc?.to, ...data?.to }
  const source = from ? parseCmsRedirectPath(from) : null
  if (!source || destination.type !== 'reference' || destination.reference?.relationTo !== source.collection) {
    throw new ValidationError({
      errors: [{ path: 'to.reference', message: 'Choose a document that matches the source URL.' }],
    })
  }

  return data
}
