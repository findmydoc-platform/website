import type { PayloadRequest } from 'payload'
import type { ClinicApplicationSource } from './catalog'

export async function findClinicApplication(req: PayloadRequest, id: number): Promise<ClinicApplicationSource | null> {
  try {
    const application = await req.payload.findByID({
      collection: 'clinicApplications',
      id,
      req,
      overrideAccess: true,
      depth: 0,
    })
    return {
      id: application.id,
      clinicName: application.clinicName,
      contactEmail: application.contactEmail,
      contactFirstName: application.contactFirstName,
      contactLastName: application.contactLastName,
    }
  } catch (error) {
    const sourceError = error as { name?: unknown; status?: unknown; statusCode?: unknown }
    if (sourceError.name === 'NotFound' || sourceError.status === 404 || sourceError.statusCode === 404) return null
    throw error
  }
}
