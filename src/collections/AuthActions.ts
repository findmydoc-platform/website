import type { CollectionConfig, Field } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import {
  guardAuthActionDelete,
  guardAuthActionOperation,
  guardAuthActionWrite,
  readAuthActionDiagnostics,
} from '@/auth/actions/lifecycle'
import { authActionTypes, authActionEnvironments, authActionStates, authActionOutcomes } from '@/auth/actions/contracts'

type ActionField = Extract<Field, { type: 'select' | 'date' | 'relationship' | 'text' }>
const diagnostic = <T extends ActionField>(field: T): T => ({ ...field, admin: { ...field.admin, readOnly: true } })
const privateField = <T extends ActionField>(field: T): T => ({
  ...field,
  admin: { ...field.admin, hidden: true, readOnly: true },
  access: { read: () => false },
})

export const AuthActions: CollectionConfig = {
  slug: 'authActions',
  labels: { singular: 'Auth Action', plural: 'Auth Actions' },
  admin: {
    group: 'Platform Management',
    description: 'Read-only authentication lifecycle diagnostics without credentials or recipient content.',
    defaultColumns: ['id', 'actionType', 'environment', 'state', 'expiresAt', 'terminalAt', 'outcomeCode'],
  },
  access: {
    admin: ({ req }) => Boolean(isPlatformStaff({ req })),
    create: () => false,
    read: isPlatformStaff,
    update: () => false,
    delete: () => false,
  },
  graphQL: false,
  lockDocuments: false,
  trash: false,
  timestamps: true,
  hooks: {
    beforeOperation: [guardAuthActionOperation],
    beforeChange: [guardAuthActionWrite],
    beforeDelete: [guardAuthActionDelete],
    afterRead: [readAuthActionDiagnostics],
  },
  fields: [
    diagnostic({
      name: 'actionType',
      type: 'select',
      required: true,
      options: [...authActionTypes],
    }),
    diagnostic({
      name: 'environment',
      type: 'select',
      required: true,
      options: [...authActionEnvironments],
    }),
    diagnostic({
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [...authActionStates],
    }),
    diagnostic({ name: 'expiresAt', type: 'date', required: true, index: true }),
    diagnostic({ name: 'terminalAt', type: 'date', index: true }),
    diagnostic({
      name: 'outcomeCode',
      type: 'select',
      options: [...authActionOutcomes],
    }),
    privateField({
      name: 'supabaseTokenType',
      type: 'select',
      required: true,
      options: ['magiclink', 'invite', 'recovery'],
    }),
    privateField({
      name: 'principal',
      type: 'relationship',
      relationTo: ['patients', 'clinicStaff', 'platformStaff'],
      maxDepth: 0,
    }),
    privateField({ name: 'principalBoundAt', type: 'date' }),
    privateField({ name: 'supabaseSubject', type: 'text' }),
    privateField({ name: 'subjectBoundAt', type: 'date' }),
    privateField({ name: 'correlationDigest', type: 'text', index: true }),
    privateField({ name: 'correlationKeyVersion', type: 'text', index: true }),
    privateField({
      name: 'callbackDestination',
      type: 'select',
      required: true,
      options: ['website-auth-callback', 'clinic-dashboard-auth-callback'],
    }),
    privateField({
      name: 'completionRoute',
      type: 'select',
      required: true,
      options: ['/patient/inquiries', '/auth/invite/complete', '/auth/password/reset/complete'],
    }),
    privateField({
      name: 'finalDestination',
      type: 'select',
      required: true,
      options: ['patient-inquiries', 'clinic-dashboard', 'platform-administration'],
    }),
  ],
}
