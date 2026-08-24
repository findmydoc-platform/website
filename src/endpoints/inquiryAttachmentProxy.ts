import type { PayloadRequest } from 'payload'

import { INQUIRY_ATTACHMENT_MAX_BYTES, INQUIRY_ATTACHMENT_MIME_TYPES } from '@/features/inquiryCommunication/contracts'
import { InquiryCommunicationServiceError, readAttachmentAccess } from '@/features/inquiryCommunication/service'
import { resolveS3StorageConfig } from '@/plugins/storageConfig'

type InquiryAttachmentProxyInput = {
  attachmentId: string
  mode: 'download' | 'preview'
  responseHeaders: Readonly<Record<string, string>>
}

const parseInteger = (value: string | undefined): number | undefined | null => {
  if (typeof value === 'undefined') return undefined
  if (!/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const safeStorageUrl = (rawUrl: string): URL | null => {
  let url: URL
  let endpoint: URL
  let storage: ReturnType<typeof resolveS3StorageConfig>
  try {
    url = new URL(rawUrl)
    storage = resolveS3StorageConfig(process.env)
    endpoint = new URL(storage.clientConfig.endpoint)
  } catch {
    return null
  }

  if (url.username || url.password || url.origin !== endpoint.origin) return null
  const basePath = endpoint.pathname.replace(/\/$/u, '')
  const bucketPath = `${basePath}/${encodeURIComponent(storage.bucket)}/`.replace(/^\/\//u, '/')
  return url.pathname.startsWith(bucketPath) ? url : null
}

const safeAttachmentDisposition = (mode: 'download' | 'preview', value: string | null): string | null => {
  if (!value || /[\u0000-\u001f\u007f]/u.test(value)) return null
  const expected = mode === 'download' ? 'attachment;' : 'inline;'
  return value.toLocaleLowerCase('en').startsWith(expected) ? value : null
}

const readBoundedAttachmentBytes = async (storedResponse: Response, expectedLength?: number): Promise<ArrayBuffer> => {
  const reader = storedResponse.body?.getReader()
  if (!reader) throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage returned no content.')

  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (!chunk.value) continue
      byteLength += chunk.value.byteLength
      if (byteLength > INQUIRY_ATTACHMENT_MAX_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment is too large.')
      }
      chunks.push(chunk.value)
    }
  } catch (error: unknown) {
    if (error instanceof InquiryCommunicationServiceError) throw error
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  if (byteLength <= 0 || (typeof expectedLength === 'number' && byteLength !== expectedLength)) {
    throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment size is invalid.')
  }

  const buffer = new ArrayBuffer(byteLength)
  const bytes = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return buffer
}

export const proxyInquiryAttachment = async (
  req: PayloadRequest,
  { attachmentId, mode, responseHeaders }: InquiryAttachmentProxyInput,
): Promise<Response> => {
  const access = await readAttachmentAccess(req, { attachmentId, mode })
  const storageUrl = safeStorageUrl(access.url)
  if (!storageUrl) throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage access is invalid.')

  let storedResponse: Response
  try {
    storedResponse = await fetch(storageUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new InquiryCommunicationServiceError('service-timeout', 'Attachment storage timed out.')
    }
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  if (!storedResponse.ok) {
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment storage is unavailable.')
  }

  const rawContentType = storedResponse.headers.get('content-type')?.split(';', 1)[0]?.trim()
  if (!rawContentType || !INQUIRY_ATTACHMENT_MIME_TYPES.includes(rawContentType as never)) {
    throw new InquiryCommunicationServiceError('unsupported-media-type', 'The attachment type is unavailable.')
  }
  const declaredLength = storedResponse.headers.get('content-length')
  const expectedLength = declaredLength === null ? undefined : parseInteger(declaredLength)
  if (
    expectedLength === null ||
    (typeof expectedLength === 'number' && expectedLength > INQUIRY_ATTACHMENT_MAX_BYTES)
  ) {
    throw new InquiryCommunicationServiceError('payload-too-large', 'The attachment is too large.')
  }

  const disposition = safeAttachmentDisposition(
    mode,
    storedResponse.headers.get('content-disposition') ?? storageUrl.searchParams.get('response-content-disposition'),
  )
  if (!disposition) {
    throw new InquiryCommunicationServiceError('unavailable', 'Attachment response metadata is unavailable.')
  }

  const bytes = await readBoundedAttachmentBytes(storedResponse, expectedLength)

  return new Response(bytes, {
    status: 200,
    headers: {
      ...responseHeaders,
      'Content-Disposition': disposition,
      'Content-Length': String(bytes.byteLength),
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Content-Type': rawContentType,
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
