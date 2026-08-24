import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { resolveS3StorageConfig } from '@/plugins/storageConfig'
import type { InquiryAttachmentAccessDTO } from './contracts'
import { INQUIRY_ATTACHMENT_MAX_BYTES, INQUIRY_ATTACHMENT_MIME_TYPES } from './contracts'

export type InquiryAttachmentMimeType = (typeof INQUIRY_ATTACHMENT_MIME_TYPES)[number]

export type SealedAttachment = {
  mimeType: InquiryAttachmentMimeType
  readyObjectKey: string
  sizeBytes: number
}

export interface InquiryAttachmentStorageGateway {
  createUpload(args: {
    draftObjectKey: string
    mimeType: InquiryAttachmentMimeType
    sizeBytes: number
  }): Promise<{ headers: Record<string, string>; method: 'PUT'; url: string }>
  sealDraft(args: {
    declaredMimeType: InquiryAttachmentMimeType
    declaredSizeBytes: number
    draftObjectKey: string
    readyObjectKey: string
  }): Promise<SealedAttachment>
  verifySealed(args: {
    expectedMimeType: InquiryAttachmentMimeType
    expectedSizeBytes: number
    readyObjectKey: string
  }): Promise<void>
  deleteObjects(objectKeys: readonly string[]): Promise<void>
  createReadAccess(args: {
    disposition: 'attachment' | 'inline'
    fileName: string
    mimeType: InquiryAttachmentMimeType
    readyObjectKey: string
  }): Promise<InquiryAttachmentAccessDTO>
}

const sniffMimeType = (bytes: Uint8Array): InquiryAttachmentMimeType | null => {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'application/pdf'
  return null
}

export const buildInquiryAttachmentContentDisposition = (
  disposition: 'attachment' | 'inline',
  fileName: string,
): string => {
  if (/[\u0000-\u001f\u007f]/u.test(fileName)) throw new Error('The attachment file name is invalid.')
  const safeName = fileName.replace(/["\\]/gu, '_')
  const asciiName = safeName.replace(/[^a-zA-Z0-9._ -]/gu, '_') || 'attachment'
  const encodedName = encodeURIComponent(safeName).replace(
    /[!'()*]/gu,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
}

const copySource = (bucket: string, key: string): string =>
  `${encodeURIComponent(bucket)}/${key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`

const readableBytes = async (body: unknown): Promise<Uint8Array> => {
  if (body && typeof body === 'object' && 'transformToByteArray' in body) {
    const transform = (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray
    if (typeof transform === 'function') return transform.call(body)
  }
  throw new Error('The attachment bytes could not be inspected.')
}

export const createS3InquiryAttachmentStorage = (): InquiryAttachmentStorageGateway => {
  const storage = resolveS3StorageConfig(process.env)
  const client = new S3Client(storage.clientConfig)
  const uploadExpiresSeconds = 15 * 60
  const readExpiresSeconds = 60

  return {
    async createUpload({ draftObjectKey, mimeType, sizeBytes }) {
      const command = new PutObjectCommand({
        Bucket: storage.bucket,
        ContentLength: sizeBytes,
        ContentType: mimeType,
        Key: draftObjectKey,
      })
      return {
        headers: {
          'content-type': mimeType,
        },
        method: 'PUT',
        url: await getSignedUrl(client, command, { expiresIn: uploadExpiresSeconds }),
      }
    },

    async sealDraft({ declaredMimeType, declaredSizeBytes, draftObjectKey, readyObjectKey }) {
      const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: draftObjectKey }))
      const actualSize = head.ContentLength
      if (
        typeof actualSize !== 'number' ||
        actualSize <= 0 ||
        actualSize > INQUIRY_ATTACHMENT_MAX_BYTES ||
        actualSize !== declaredSizeBytes
      ) {
        throw new Error('The attachment size does not match the verified draft.')
      }

      const inspected = await client.send(
        new GetObjectCommand({ Bucket: storage.bucket, Key: draftObjectKey, Range: 'bytes=0-31' }),
      )
      const actualMimeType = sniffMimeType(await readableBytes(inspected.Body))
      if (!actualMimeType || actualMimeType !== declaredMimeType || head.ContentType !== declaredMimeType) {
        throw new Error('The attachment content type does not match the verified draft.')
      }

      await client.send(
        new CopyObjectCommand({
          Bucket: storage.bucket,
          ContentType: actualMimeType,
          CopySource: copySource(storage.bucket, draftObjectKey),
          Key: readyObjectKey,
          MetadataDirective: 'REPLACE',
        }),
      )
      const readyHead = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: readyObjectKey }))
      if (readyHead.ContentLength !== actualSize || readyHead.ContentType !== actualMimeType) {
        await client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: readyObjectKey }))
        throw new Error('The sealed attachment could not be verified.')
      }
      return { mimeType: actualMimeType, readyObjectKey, sizeBytes: actualSize }
    },

    async verifySealed({ expectedMimeType, expectedSizeBytes, readyObjectKey }) {
      const head = await client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: readyObjectKey }))
      if (head.ContentLength !== expectedSizeBytes || head.ContentType !== expectedMimeType) {
        throw new Error('The sealed attachment metadata changed.')
      }
      const inspected = await client.send(
        new GetObjectCommand({ Bucket: storage.bucket, Key: readyObjectKey, Range: 'bytes=0-31' }),
      )
      if (sniffMimeType(await readableBytes(inspected.Body)) !== expectedMimeType) {
        throw new Error('The sealed attachment content changed.')
      }
    },

    async deleteObjects(objectKeys) {
      for (const objectKey of new Set(objectKeys.filter(Boolean))) {
        await client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: objectKey }))
      }
    },

    async createReadAccess({ disposition, fileName, mimeType, readyObjectKey }) {
      const command = new GetObjectCommand({
        Bucket: storage.bucket,
        Key: readyObjectKey,
        ResponseContentDisposition: buildInquiryAttachmentContentDisposition(disposition, fileName),
        ResponseContentType: mimeType,
      })
      return {
        expiresAt: new Date(Date.now() + readExpiresSeconds * 1_000).toISOString(),
        method: 'GET',
        url: await getSignedUrl(client, command, { expiresIn: readExpiresSeconds }),
      }
    },
  }
}
