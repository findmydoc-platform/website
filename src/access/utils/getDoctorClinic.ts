import type { Payload } from 'payload'

export async function getDoctorClinicId(doctorId: string | number | null | undefined, payload: Payload | undefined) {
  if (!doctorId || !payload) {
    return null
  }

  try {
    const doctor = await payload.findByID({ collection: 'doctors', id: doctorId, depth: 0 })
    const clinic = (doctor as any)?.clinic
    if (!clinic) return null
    if (typeof clinic === 'object') {
      return clinic.id ? String(clinic.id) : null
    }
    return String(clinic)
  } catch (error) {
    payload.logger.error({ err: error }, 'Error resolving doctor clinic for media access')
    return null
  }
}
