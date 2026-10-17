import { getServerSideURL } from '@/utilities/getURL'
import {
  addDataAndFileToRequest,
  APIError,
  type RequiredDataFromCollectionSlug,
  type Endpoint,
  type PayloadHandler,
  type Where,
} from 'payload'
import { revalidateClinicDashboardTargetRequest } from '@/features/clinicDashboard/authorization'
import { clinicAssignmentRelationId as relationId } from '@/auth/utilities/clinicStaffAssignment'
import { CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS } from './clinicDashboardBootstrap'

type DoctorCollection = 'doctors' | 'doctorspecialties' | 'doctorMedia'
const response = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS })

/** The path selects a clinic. Native collection access and hooks authorize every stored source and write. */
function handler(
  collection: DoctorCollection,
  method: 'get' | 'post' | 'patch' | 'delete',
  single = false,
): PayloadHandler {
  return async (req) => {
    const clinicId = relationId(req.routeParams?.clinicId)
    const id = single ? relationId(req.routeParams?.id) : null
    if (!clinicId || (single && !id)) return response({ error: { code: 'INVALID_INPUT' } }, 400)
    const authorization = await revalidateClinicDashboardTargetRequest(req, String(clinicId))
    if (authorization.status !== 'authorized')
      return response(
        {
          error: {
            code:
              authorization.status === 'unauthorized'
                ? 'UNAUTHENTICATED'
                : authorization.status === 'access-denied'
                  ? 'CONTENT_ACCESS_DENIED'
                  : 'SERVICE_UNAVAILABLE',
          },
        },
        authorization.status === 'unauthorized' ? 401 : authorization.status === 'access-denied' ? 403 : 503,
      )
    try {
      const query = req.query ?? {}
      const sourceScope: Where = {
        [collection === 'doctorspecialties' ? 'doctor.clinic' : 'clinic']: { equals: clinicId },
      }
      const where: Where = {
        and: [
          sourceScope,
          ...(id ? [{ id: { equals: id } }] : []),
          ...(query.where && typeof query.where === 'object' ? [query.where as Where] : []),
        ],
      }
      const options = { collection, req, overrideAccess: false as const, depth: 1 }
      if (method === 'get')
        return response(
          await req.payload.find({
            ...options,
            where,
            pagination: false,
            limit: collection === 'doctors' ? 100 : 1000,
          }),
        )
      if (single) {
        const current = await req.payload.find({ ...options, depth: 0, where, limit: 1 })
        if (!current.docs[0]) return response({ error: { code: 'TARGET_UNAVAILABLE' } }, 404)
      }
      if (method === 'delete') {
        if (!id || collection !== 'doctorMedia') return response({ error: { code: 'CONTENT_ACCESS_DENIED' } }, 403)
        return response(await req.payload.delete({ ...options, id }))
      }
      await addDataAndFileToRequest(req)
      const data = req.data
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return response({ error: { code: 'INVALID_INPUT' } }, 400)
      if (collection === 'doctors' && Object.hasOwn(data, 'clinic') && relationId(data.clinic) !== clinicId)
        return response({ error: { code: 'CONTENT_ACCESS_DENIED' } }, 403)
      if (method === 'post') {
        const created = await req.payload.create({
          ...options,
          collection,
          data: {
            ...data,
            ...(collection === 'doctors' ? { clinic: clinicId } : {}),
          } as RequiredDataFromCollectionSlug<DoctorCollection>,
          ...(req.file ? { file: req.file } : {}),
        })
        return response(created, 201)
      }
      return response(
        id ? await req.payload.update({ ...options, id, data }) : await req.payload.update({ ...options, where, data }),
      )
    } catch (error: unknown) {
      const status =
        error instanceof APIError && [400, 403, 404, 409, 413, 415].includes(error.status) ? error.status : 503
      return response(
        {
          error: {
            code:
              status === 403
                ? 'CONTENT_ACCESS_DENIED'
                : status === 404
                  ? 'TARGET_UNAVAILABLE'
                  : status === 409
                    ? 'DOCTOR_CONFLICT'
                    : status === 503
                      ? 'SERVICE_UNAVAILABLE'
                      : 'INVALID_INPUT',
          },
        },
        status,
      )
    }
  }
}

const doctorImageHandler: PayloadHandler = async (req) => {
  const clinicId = relationId(req.routeParams?.clinicId)
  const doctorId = relationId(req.routeParams?.id)
  if (!clinicId || !doctorId || new URL(req.url ?? 'http://localhost:3000').search)
    return response({ error: { code: 'INVALID_INPUT' } }, 400)
  const authorization = await revalidateClinicDashboardTargetRequest(req, String(clinicId))
  if (authorization.status !== 'authorized')
    return response(
      {
        error: {
          code:
            authorization.status === 'unauthorized'
              ? 'UNAUTHENTICATED'
              : authorization.status === 'access-denied'
                ? 'CONTENT_ACCESS_DENIED'
                : 'SERVICE_UNAVAILABLE',
        },
      },
      authorization.status === 'unauthorized' ? 401 : authorization.status === 'access-denied' ? 403 : 503,
    )
  try {
    const doctor = (
      await req.payload.find({
        collection: 'doctors',
        where: { and: [{ id: { equals: doctorId } }, { clinic: { equals: clinicId } }] },
        req,
        overrideAccess: false,
        depth: 0,
        limit: 1,
      })
    ).docs[0]
    const mediaId = relationId(doctor?.profileImage)
    if (!mediaId) return response({ error: { code: 'TARGET_UNAVAILABLE' } }, 404)
    const media = (
      await req.payload.find({
        collection: 'doctorMedia',
        where: {
          and: [{ id: { equals: mediaId } }, { doctor: { equals: doctorId } }, { clinic: { equals: clinicId } }],
        },
        req,
        overrideAccess: false,
        depth: 0,
        limit: 1,
      })
    ).docs[0]
    if (!media?.url) return response({ error: { code: 'TARGET_UNAVAILABLE' } }, 404)
    const source = new URL(media.url, getServerSideURL())
    if (source.origin !== new URL(getServerSideURL()).origin || !source.pathname.startsWith('/api/doctorMedia/file/'))
      throw new Error('Invalid doctor image source.')
    const upstream = await fetch(source, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Authorization: req.headers.get('authorization') ?? '' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!upstream.ok)
      return response(
        { error: { code: upstream.status === 403 ? 'CONTENT_ACCESS_DENIED' : 'SERVICE_UNAVAILABLE' } },
        upstream.status === 403 ? 403 : 503,
      )
    const mimeType = upstream.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (
      !mimeType ||
      !['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
      Number(upstream.headers.get('content-length')) > 5 * 1024 * 1024 ||
      !upstream.body
    )
      throw new Error('Invalid doctor image response.')
    const reader = upstream.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 5 * 1024 * 1024) throw new Error('Doctor image is too large.')
        chunks.push(value)
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Response(bytes, {
      headers: {
        ...CLINIC_DASHBOARD_PRIVATE_LIVE_HEADERS,
        'Content-Type': mimeType,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return response({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503)
  }
}

export const clinicDashboardDoctorEndpoints: Endpoint[] = [
  { path: '/clinic-dashboard/clinics/:clinicId/doctors/:id/image', method: 'get', handler: doctorImageHandler },
  ...(['doctors', 'doctor-specialties', 'doctor-media'] as const).flatMap((path) => {
    const collection =
      path === 'doctors' ? 'doctors' : path === 'doctor-specialties' ? 'doctorspecialties' : 'doctorMedia'
    const prefix = `/clinic-dashboard/clinics/:clinicId/${path}`
    return [
      { path: prefix, method: 'get' as const, handler: handler(collection, 'get') },
      { path: prefix, method: 'post' as const, handler: handler(collection, 'post') },
      { path: prefix, method: 'patch' as const, handler: handler(collection, 'patch') },
      { path: `${prefix}/:id`, method: 'patch' as const, handler: handler(collection, 'patch', true) },
      ...(collection === 'doctorMedia'
        ? [{ path: `${prefix}/:id`, method: 'delete' as const, handler: handler(collection, 'delete', true) }]
        : []),
    ]
  }),
]
