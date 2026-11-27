import { APIError, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { standardMediaImageMimeTypes } from '@/collections/common/mediaCollection'
import { getUnsupportedMediaFormatMessage } from '@/config/mediaUploadPolicy'
import type { PlatformContentMedia } from '@/payload-types'

// Base64 and the JSON-RPC fields must fit the MCP transport's 4 MiB request body limit.
const mcpImageLimit = 3_100_000
const imageTooLarge = 'Image is too large. MCP accepts images up to 3.1 MB.'
const invalidBase64 = 'Provide the image bytes as valid Base64.'

const uploadEditorialImageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a filename.')
    .max(128)
    .refine(
      (name) => ![...name].some((char) => char === '/' || char === '\\' || char.charCodeAt(0) < 32),
      'Use a filename without a path or control characters.',
    ),
  mimeType: z.enum(standardMediaImageMimeTypes, getUnsupportedMediaFormatMessage(standardMediaImageMimeTypes)),
  base64: z
    .string()
    .min(4, invalidBase64)
    .max(Math.ceil(mcpImageLimit / 3) * 4, { error: imageTooLarge, abort: true })
    .check(z.base64(invalidBase64)),
  alt: z.string().trim().min(1, 'Enter alternative text.').max(2_000),
})

export const uploadEditorialImageTool = {
  name: 'uploadEditorialImage',
  description:
    'Upload an editorial image with alternative text. Supply Base64-encoded image bytes (up to 3.1 MB before encoding). The returned ID can be used in a Post draft.',
  parameters: uploadEditorialImageSchema.shape,
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const input = uploadEditorialImageSchema.parse(args)
    const fileData = Buffer.from(input.base64, 'base64')
    if (fileData.length > mcpImageLimit) throw new APIError(imageTooLarge, 413)
    const media = await req.payload.create({
      collection: 'platformContentMedia',
      // The media collection sets the uploader and storage path during creation.
      data: { alt: input.alt } as Pick<PlatformContentMedia, 'alt' | 'createdBy' | 'storagePath'>,
      file: { name: input.name, mimetype: input.mimeType, size: fileData.length, data: fileData },
      depth: 0,
      overrideAccess: false,
      req,
      user: req.user,
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify({ id: media.id }) }] }
  },
}
