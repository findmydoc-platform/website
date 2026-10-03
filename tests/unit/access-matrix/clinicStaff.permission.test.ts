import { ClinicStaff } from '@/collections/ClinicStaff'
import { makePermissionSuite } from './generatePermissionSuite'
import { describe, expect, it } from 'vitest'
import { mockUsers } from '../helpers/mockUsers'
import { createAccessArgs } from '../helpers/testHelpers'

makePermissionSuite('clinicStaff', ClinicStaff)

describe('private clinic invitation authorization', () => {
  it.each([mockUsers.platform(), mockUsers.clinic(), mockUsers.patient(), null])(
    'keeps the durable invitation marker unavailable to generic roles',
    async (user) => {
      const field = ClinicStaff.fields.find((field) => 'name' in field && field.name === 'invitationAuthorizedAt')!
      expect('access' in field).toBe(true)
      if (!('access' in field)) throw new Error('Missing field access')
      const args = createAccessArgs(user)
      expect(await field.access!.create!(args)).toBe(false)
      expect(await field.access!.read!(args)).toBe(false)
      expect(await field.access!.update!(args)).toBe(false)
    },
  )
})
