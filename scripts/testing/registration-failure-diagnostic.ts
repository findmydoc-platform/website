const allowed = {
  code: new Set([
    '40001',
    '40P01',
    '23505',
    '23503',
    '25P02',
    'P0001',
    'transaction-conflict',
    'storage-unavailable',
    'clinic-registration-unavailable',
    'source-missing',
    'access-denied',
    'invalid-command',
    'invalid-data',
  ]),
  constraint: new Set([
    'commandType_operationReference_idx',
    'transactional_email_events_provider_event_id_idx',
    'outbox_sequence_idx',
    'runtimeEnvironment_recipientDigest_idx',
    'clinic_applications_pkey',
  ]),
  collection: new Set([
    'clinicApplications',
    'clinicStaff',
    'transactionalEmailOutbox',
    'transactionalEmailEvents',
    'transactionalEmailSuppressions',
  ]),
  path: new Set([
    'id',
    'contactEmail',
    'clinicName',
    'medicalSpecialties',
    'email',
    'supabaseUserId',
    'command_type, operation_reference',
    'outbox_id, sequence',
    'provider_event_id',
    'runtime_environment, recipient_digest',
  ]),
}
type FailureDetail = Partial<Record<keyof typeof allowed, string>>
/** Closed diagnostic values only. Never serialize an error, SQL, message, request or submitted value. */
export function registrationFailureDiagnostic(error: unknown): FailureDetail[] {
  const result: FailureDetail[] = []
  const visited = new Set<unknown>()
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || depth > 6 || visited.has(value)) return
    visited.add(value)
    const source = value as Record<string, unknown>
    const detail: FailureDetail = {}
    for (const key of ['code', 'constraint', 'collection', 'path'] as const) {
      if (typeof source[key] === 'string') detail[key] = allowed[key].has(source[key]) ? source[key] : 'unrecognized'
    }
    if (Object.keys(detail).length && result.length < 20) result.push(detail)
    visit(source.cause, depth + 1)
    visit(source.data, depth + 1)
    if (Array.isArray(source.errors)) for (const entry of source.errors.slice(0, 20)) visit(entry, depth + 1)
  }
  visit(error, 0)
  return result
}
