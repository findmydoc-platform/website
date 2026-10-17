import type { Payload, PayloadRequest } from 'payload'
import type { Doctor } from '@/payload-types'

export async function getDoctorClinicId(
  doctorId: string | number | null | undefined,
  payload: Payload | undefined,
  req?: PayloadRequest,
) {
  if (!doctorId || !payload) {
    return null
  }

  try {
    const doctor = (await payload.findByID({
      collection: 'doctors',
      id: doctorId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as Doctor
    const clinic = doctor?.clinic
    if (!clinic) return null
    if (typeof clinic === 'object') {
      return clinic.id ? String(clinic.id) : null
    }
    return String(clinic)
  } catch (error) {
    payload.logger.error(error, 'Error resolving doctor clinic for media access')
    return null
  }
}
