import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { readClinicNotifications, markClinicNotificationsRead } from '@/features/clinicNotifications/service'
import { createMockPayload, createMockReq } from '../helpers/testHelpers'

vi.mock('payload', async (original) => ({
  ...(await original<typeof import('payload')>()),
  createLocalReq: async (options: { user?: unknown; context?: object; req?: object }, payload: unknown) => ({
    user: options.user,
    context: options.context ?? {},
    ...options.req,
    payload,
  }),
}))

const staff = {
  id: 22,
  collection: 'clinicStaff',
  email: 'reader@example.invalid',
  supabaseUserId: 'personal-reader',
  status: 'approved',
  authSync: { status: 'synced' },
  assignmentScope: 'group',
  clinic: null,
  group: 4,
  activationReadiness: {
    version: 'identity-v1',
    principalId: '22',
    subject: 'personal-reader',
    establishedAt: '2026-01-01T00:00:00Z',
  },
}
type Row = Record<string, unknown>
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'and') return (value as Row[]).every((part) => matches(row, part))
    if (key === 'or') return (value as Row[]).some((part) => matches(row, part))
    const rules = value as Row
    return Object.entries(rules).every(([operator, expected]) => {
      const actual = row[key]
      if (operator === 'equals') return String(actual) === String(expected)
      if (operator === 'not_equals') return actual !== expected
      if (operator === 'in') return (expected as unknown[]).includes(actual)
      if (operator === 'exists') return (actual != null) === expected
      if (operator === 'greater_than') return (actual as string) > (expected as string)
      if (operator === 'less_than_equal') return (actual as string) <= (expected as string)
      throw new Error(`Unsupported test database predicate ${operator}`)
    })
  })
}

function fixture() {
  const now = Date.now()
  const occurrence = (id: number, clinic: string) => ({
    id,
    notificationId: `notice-${id}`,
    schemaVersion: 1,
    eventType: 'review_published',
    clinicScopeId: clinic,
    sourceRecordKind: 'review',
    sourceRecordId: String(id),
    sourceOccurrenceKind: 'review_transition',
    sourceOccurrenceId: String(id),
    occurredAt: new Date(now - id * 1000).toISOString(),
    expiresAt: new Date(now - id * 1000 + 90 * 86400_000).toISOString(),
  })
  const rows: Record<string, Row[]> = {
    clinicStaff: [{ ...staff }],
    clinics: [
      { id: 8, name: 'Alpha current', group: 4, participationStatus: 'approved' },
      { id: 9, name: 'Beta current', group: 4, participationStatus: 'approved' },
      { id: 10, name: 'Foreign', group: 5, participationStatus: 'approved' },
    ],
    clinicNotificationOccurrences: [occurrence(1, '8'), occurrence(2, '9'), occurrence(3, '10')],
    clinicNotificationReadReceipts: [],
    reviews: [],
  }
  const payload = Object.assign(createMockPayload(), {
    secret: randomUUID(),
    db: {
      sessions: { 'tx-237': {} },
      beginTransaction: vi.fn().mockResolvedValue('tx-237'),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
    },
  })
  payload.findByID.mockResolvedValue({ id: 4 })
  payload.find.mockImplementation(async (args) => {
    const selected = (rows[args.collection] ?? []).filter((row) => matches(row, args.where as Row))
    if (args.sort === '-id') selected.sort((a, b) => Number(b.id) - Number(a.id))
    else selected.sort((a, b) => Number(a.id) - Number(b.id))
    const limit = args.limit ?? 100
    const offset = ((args.page ?? 1) - 1) * limit
    return { docs: selected.slice(offset, offset + limit), hasNextPage: selected.length > offset + limit } as never
  })
  payload.create.mockImplementation(async (args) => {
    const row = { id: (rows[args.collection]?.length ?? 0) + 1, ...args.data }
    ;(rows[args.collection] ??= []).push(row)
    return row
  })
  payload.update.mockImplementation(async (args) => ({ id: args.id, ...args.data }))
  return { rows, payload, req: createMockReq(staff, payload) }
}

describe('current personal notification feed', () => {
  it('projects the union of current eligible clinics with current clinic attribution and no foreign entries', async () => {
    const { req } = fixture()
    expect(await readClinicNotifications(req, { mode: 'page', view: 'unread' })).toMatchObject({
      unreadCount: 2,
      items: [
        { clinic: { id: '8', name: 'Alpha current' }, members: [{ notificationId: 'notice-1' }] },
        { clinic: { id: '9', name: 'Beta current' }, members: [{ notificationId: 'notice-2' }] },
      ],
    })
  })

  it('continues the personal cursor under fresh clinic scope rather than a selected clinic snapshot', async () => {
    const { req, rows } = fixture()
    const original = rows.clinicNotificationOccurrences![0]!
    const now = Date.now()
    rows.clinicNotificationOccurrences = Array.from({ length: 28 }, (_, index) => ({
      ...original,
      id: index + 1,
      notificationId: `notice-${index + 1}`,
      sourceRecordId: String(index + 1),
      sourceOccurrenceId: String(index + 1),
      clinicScopeId: index % 2 ? '9' : '8',
      occurredAt: new Date(now - (index + 1) * 1000).toISOString(),
      expiresAt: new Date(now - (index + 1) * 1000 + 90 * 86400_000).toISOString(),
    }))
    const first = await readClinicNotifications(req, { mode: 'page', view: 'unread' })
    if (first.mode !== 'page' || !first.nextCursor) throw new Error('Expected personal continuation')
    expect(first.items).toHaveLength(25)
    rows.clinics![0]!.group = 5
    req.routeParams = { clinicId: '9' }
    const next = await readClinicNotifications(req, { mode: 'page', view: 'unread', cursor: first.nextCursor })
    expect(next).toMatchObject({
      items: [{ members: [{ notificationId: 'notice-26' }] }, { members: [{ notificationId: 'notice-28' }] }],
      nextCursor: null,
    })
    expect(next).not.toHaveProperty('unreadCount')
  })

  it('keeps patient-message groups separate by source clinic even when inquiry identities match', async () => {
    const { req, rows } = fixture()
    rows.clinicNotificationOccurrences = rows.clinicNotificationOccurrences!.map((row) => ({
      ...row,
      sourceRecordId: 'missing-inquiry',
      sourceRecordKind: 'inquiry',
      eventType: 'patient_message_received',
      sourceOccurrenceKind: 'patient_message',
    }))
    const page = await readClinicNotifications(req, { mode: 'page', view: 'unread' })
    expect(page).toMatchObject({
      unreadCount: 2,
      items: [
        { kind: 'patient_message_group', clinic: { id: '8' }, members: [{ notificationId: 'notice-1' }] },
        { kind: 'patient_message_group', clinic: { id: '9' }, members: [{ notificationId: 'notice-2' }] },
      ],
    })
    if (page.mode !== 'page') throw new Error('Expected page')
    expect(new Set(page.items.map((item) => item.presentationId)).size).toBe(2)
  })

  it('returns an empty approved personal feed when every clinic becomes ineligible', async () => {
    const { req, rows } = fixture()
    rows.clinics = []
    expect(await readClinicNotifications(req, { mode: 'summary' })).toMatchObject({
      unreadCount: 0,
      nextUnreadCountChangeAt: null,
    })
    expect(await readClinicNotifications(req, { mode: 'page', view: 'all' })).toMatchObject({
      items: [],
      unreadCount: 0,
      nextCursor: null,
    })
  })

  it('acknowledges one fixed cross-clinic selection and preserves each first personal read time on repetition', async () => {
    const { req } = fixture()
    await expect(
      markClinicNotificationsRead(req, { notificationIds: ['notice-1', 'notice-2', 'notice-3', 'missing'] }),
    ).resolves.toMatchObject({ acknowledged: true })
    const first = await readClinicNotifications(req, { mode: 'page', view: 'all' })
    if (first.mode !== 'page') throw new Error('Expected personal page')
    expect(first.items.map((item) => item.members[0]!.readAt)).toEqual([expect.any(String), expect.any(String)])
    await markClinicNotificationsRead(req, { notificationIds: ['notice-1', 'notice-2'] })
    const repeated = await readClinicNotifications(req, { mode: 'page', view: 'all' })
    if (repeated.mode !== 'page') throw new Error('Expected personal page')
    expect(repeated.items.map((item) => item.members[0]!.readAt)).toEqual(
      first.items.map((item) => item.members[0]!.readAt),
    )
    expect(await readClinicNotifications(req, { mode: 'summary' })).toMatchObject({ unreadCount: 0 })
  })

  it('rechecks the eligible part of the fixed selection after an assignment changes before the barrier', async () => {
    const { req, rows, payload } = fixture()
    payload.db.beginTransaction.mockImplementationOnce(async () => {
      rows.clinicStaff = [{ ...staff, assignmentScope: 'local', clinic: 9, group: null }]
      return 'tx-237'
    })
    await markClinicNotificationsRead(req, { notificationIds: ['notice-1', 'notice-2', 'notice-3'] })
    rows.clinicStaff = [{ ...staff }]
    const page = await readClinicNotifications(req, { mode: 'page', view: 'all' })
    expect(page).toMatchObject({
      unreadCount: 1,
      items: [
        { members: [{ notificationId: 'notice-1', readAt: null }] },
        { members: [{ notificationId: 'notice-2', readAt: expect.any(String) }] },
      ],
    })
  })

  it('deduplicates current source reads for a complete large group without truncating its members', async () => {
    const { req, rows, payload } = fixture()
    const original = rows.clinicNotificationOccurrences![0]!
    rows.clinicNotificationOccurrences = Array.from({ length: 111 }, (_, index) => ({
      ...original,
      id: index + 1,
      notificationId: `large-${index}`,
      sourceRecordId: 'missing-inquiry',
      sourceRecordKind: 'inquiry',
      eventType: 'patient_message_received',
      sourceOccurrenceKind: 'patient_message',
      sourceOccurrenceId: String(index),
    }))
    const page = await readClinicNotifications(req, { mode: 'page', view: 'unread' })
    expect(page).toMatchObject({ unreadCount: 1, items: [{ kind: 'patient_message_group' }] })
    if (page.mode !== 'page') throw new Error('Expected personal page')
    expect(page.items[0]!.members).toHaveLength(111)
    expect(payload.find.mock.calls.filter(([args]) => args.collection === 'patientClinicInquiries')).toHaveLength(1)
  })
})
