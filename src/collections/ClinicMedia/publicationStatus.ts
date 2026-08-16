import type { ClinicMedia } from '@/payload-types'
import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

export const beforeChangeValidatePublishedClinicMedia: CollectionBeforeChangeHook<ClinicMedia> = ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const status = data.status ?? originalDoc?.status ?? 'draft'
  const alt = data.alt ?? originalDoc?.alt

  if (status === 'published' && (typeof alt !== 'string' || alt.trim().length === 0)) {
    throw new ValidationError({
      collection: 'clinicMedia',
      errors: [
        {
          label: 'Alt text',
          message: 'Alt text is required before this image can be published.',
          path: 'alt',
        },
      ],
      id: originalDoc?.id,
      req,
    })
  }

  data.status = status
  return data
}
