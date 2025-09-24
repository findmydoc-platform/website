import type { CollectionBeforeChangeHook } from 'payload'

/**
 * beforeChangeClinicMedia
 * - Freeze clinic ownership on update
 * - Auto-set createdBy on create (from req.user)
 * - Compute storagePath and adjust filename subpath for S3 foldering
 */
export const beforeChangeClinicMedia: CollectionBeforeChangeHook<any> = async ({ data, operation, req, originalDoc }) => {
  const d: any = data || {}

  // Freeze clinic ownership after creation
  if (operation === 'update' && originalDoc?.clinic) {
    const incomingClinic = typeof d.clinic === 'object' ? d.clinic?.id : d.clinic
    const existingClinic = typeof originalDoc.clinic === 'object' ? originalDoc.clinic?.id : originalDoc.clinic
    if (incomingClinic && String(incomingClinic) !== String(existingClinic)) {
      throw new Error('Clinic ownership cannot be changed once set')
    }
  }

  // Auto-set createdBy on create
  if (operation === 'create' && req.user && req.user.collection === 'basicUsers') {
    d.createdBy = d.createdBy ?? req.user.id
  }

  // Compute storagePath hint for audit/UX and adjust filename subpath for S3
  const clinicId = typeof d.clinic === 'object' ? d.clinic?.id : d.clinic
  if (clinicId) {
    d.storagePath = `clinics/${clinicId}`
    if (operation === 'create' && typeof d.filename === 'string') {
      // Place file under clinics/{clinicId}/<originalName>
      const original = d.filename.replace(/^\/+/, '')
      d.filename = `${clinicId}/${original}`
    }
  }

  return d
}
