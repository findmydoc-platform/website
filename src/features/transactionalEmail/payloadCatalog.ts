import type { PayloadRequest } from 'payload'
import { createCommandCatalog } from './catalog'
import { findClinicApplication } from './clinicApplicationSource'

export function bindPayloadCommandCatalog(req: PayloadRequest) {
  return createCommandCatalog({ findClinicApplication: (id) => findClinicApplication(req, id) })
}
