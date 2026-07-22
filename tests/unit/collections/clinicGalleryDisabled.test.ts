import { describe, expect, it } from 'vitest'

import { disabledClinicGalleryAccess } from '@/access/clinicGallery'
import { ClinicGalleryEntries } from '@/collections/ClinicGalleryEntries'
import { ClinicGalleryMedia } from '@/collections/ClinicGalleryMedia'
import { Clinics } from '@/collections/Clinics'

function findNamedField(fields: unknown[], name: string): Record<string, unknown> | undefined {
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue

    const candidate = field as Record<string, unknown>
    if (candidate.name === name) return candidate

    if (Array.isArray(candidate.fields)) {
      const nested = findNamedField(candidate.fields, name)
      if (nested) return nested
    }

    if (Array.isArray(candidate.tabs)) {
      for (const tab of candidate.tabs) {
        if (!tab || typeof tab !== 'object') continue
        const tabFields = (tab as Record<string, unknown>).fields
        if (!Array.isArray(tabFields)) continue

        const nested = findNamedField(tabFields, name)
        if (nested) return nested
      }
    }
  }

  return undefined
}

describe('disabled clinic before-and-after gallery', () => {
  it('keeps both collections registered but hidden and fail-closed', async () => {
    for (const collection of [ClinicGalleryEntries, ClinicGalleryMedia]) {
      expect(collection.admin?.hidden).toBe(true)
      expect(collection.endpoints).toBe(false)
      expect(collection.graphQL).toBe(false)
      expect(collection.access?.admin).toBe(disabledClinicGalleryAccess)
      expect(collection.access?.create).toBe(disabledClinicGalleryAccess)
      expect(collection.access?.read).toBe(disabledClinicGalleryAccess)
      expect(collection.access?.update).toBe(disabledClinicGalleryAccess)
      expect(collection.access?.delete).toBe(disabledClinicGalleryAccess)
    }

    expect(await disabledClinicGalleryAccess({} as never)).toBe(false)
  })

  it('retains the clinic relationship while hiding it from editors', () => {
    const galleryEntries = findNamedField(Clinics.fields, 'galleryEntries')

    expect(galleryEntries).toMatchObject({
      name: 'galleryEntries',
      type: 'relationship',
      relationTo: 'clinicGalleryEntries',
      hasMany: true,
      access: {
        create: disabledClinicGalleryAccess,
        read: disabledClinicGalleryAccess,
        update: disabledClinicGalleryAccess,
      },
      admin: {
        hidden: true,
      },
    })
  })
})
