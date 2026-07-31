import type { CollectionBeforeChangeHook } from 'payload'

const PROFILE_FIELDS = ['name', 'description', 'address', 'supportedLanguages', 'openingHours'] as const

export const setClinicProfileRevision: CollectionBeforeChangeHook = ({ data, operation, originalDoc }) => {
  if (!data) return data

  if (operation === 'create') {
    data.profileRevision = 0
    return data
  }

  const changesPublishedProfile = PROFILE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(data, field))

  data.profileRevision = changesPublishedProfile
    ? Number(originalDoc?.profileRevision ?? 0) + 1
    : originalDoc?.profileRevision

  return data
}
