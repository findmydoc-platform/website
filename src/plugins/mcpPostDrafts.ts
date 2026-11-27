import { APIError, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { CONTENT_LOCALES, type ContentLocale } from '@/utilities/contentLocalization'

const id = z.number().int().positive().safe()
const relationList = z.array(id).optional()
const nonEmptyText = z.string().trim().min(1)

const postDraftFields = {
  title: nonEmptyText,
  slug: nonEmptyText.optional(),
  excerpt: z.string().optional(),
  content: z
    .object({
      root: z.object({
        type: z.literal('root'),
        children: z.array(z.object({ type: z.string(), version: z.number() }).passthrough()),
        direction: z.enum(['ltr', 'rtl']).nullable(),
        format: z.enum(['left', 'start', 'center', 'right', 'end', 'justify', '']),
        indent: z.number(),
        version: z.number(),
      }),
    })
    .optional(),
  heroImage: id.nullable().optional(),
  categories: relationList,
  tags: relationList,
  authors: relationList,
  relatedPosts: relationList,
  meta: z
    .object({
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      image: id.nullable().optional(),
    })
    .strict()
    .optional(),
}

const createInput = z.object({ locale: z.literal('de'), data: z.object(postDraftFields).strict() })
const updateInput = z.object({
  id,
  locale: z.enum(CONTENT_LOCALES),
  data: z
    .object(postDraftFields)
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0),
})

type DraftData = z.infer<typeof updateInput>['data']

async function verifyAttachments(req: PayloadRequest, data: DraftData) {
  const references = {
    platformContentMedia: [data.heroImage, data.meta?.image],
    categories: data.categories ?? [],
    tags: data.tags ?? [],
    platformStaff: data.authors ?? [],
    posts: data.relatedPosts ?? [],
  } as const

  for (const collection of ['platformContentMedia', 'categories', 'tags', 'platformStaff', 'posts'] as const) {
    const ids = [...new Set(references[collection].filter((value) => typeof value === 'number'))]
    if (!ids.length) continue
    const { docs } = await req.payload.find({
      collection,
      depth: 0,
      pagination: false,
      overrideAccess: false,
      req,
      select: { createdAt: true },
      where: { id: { in: ids } },
    })
    if (docs.length !== ids.length) throw new APIError(`Some ${collection} references are unavailable.`, 422)
  }
}

function draftResult(id: number, locale: ContentLocale, englishTitle?: string | null) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          id,
          locale,
          status: 'draft',
          advisories: englishTitle?.trim() ? [] : ['missing_english'],
        }),
      },
    ],
  }
}

export const createPostDraft = {
  name: 'createPostDraft',
  description: 'Create a German (de) Post draft. Use updatePostDraft with its ID to add English later.',
  parameters: createInput.shape,
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const { data, locale } = createInput.parse(args)
    await verifyAttachments(req, data)
    const post = await req.payload.create({
      collection: 'posts',
      data,
      depth: 0,
      draft: true,
      fallbackLocale: false,
      locale,
      overrideAccess: false,
      req,
    })
    return draftResult(post.id, locale)
  },
}

export const updatePostDraft = {
  name: 'updatePostDraft',
  description:
    'Save changes to the German or English draft of an existing Post. Shared attachments apply to both drafts.',
  parameters: updateInput.shape,
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const { data, id, locale } = updateInput.parse(args)
    if (data.relatedPosts?.includes(id)) throw new APIError('A Post cannot refer to itself as a related Post.', 422)
    await verifyAttachments(req, data)
    const english =
      locale === 'de'
        ? await req.payload.findByID({
            collection: 'posts',
            id,
            locale: 'en',
            fallbackLocale: false,
            draft: true,
            overrideAccess: false,
            depth: 0,
            req,
            select: { title: true },
          })
        : null
    const post = await req.payload.update({
      collection: 'posts',
      id,
      data,
      depth: 0,
      draft: true,
      fallbackLocale: false,
      locale,
      overrideAccess: false,
      overrideLock: false,
      req,
    })
    return draftResult(post.id, locale, locale === 'de' ? english?.title : post.title)
  },
}
