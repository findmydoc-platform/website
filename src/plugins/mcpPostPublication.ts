import { APIError, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { CONTENT_LOCALES, type ContentLocale } from '@/utilities/contentLocalization'

const input = z.object({
  id: z.number().int().positive().safe(),
  locale: z.enum(CONTENT_LOCALES),
  dryRun: z.boolean().optional(),
})

function readDraft(req: PayloadRequest, id: number, locale: ContentLocale) {
  return req.payload.findByID({
    collection: 'posts',
    id,
    locale,
    draft: true,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: false,
    req,
    select: { title: true, _status: true },
  })
}

export const publishPost = {
  name: 'publishPost',
  description:
    'Publish one Post draft in de or en. For both, check both with dryRun and report missing drafts before publishing each separately.',
  parameters: input.shape,
  handler: async (args: Record<string, unknown>, req: PayloadRequest) => {
    const { id, locale, dryRun } = input.parse(args)
    const draft = await readDraft(req, id, locale)
    const english = locale === 'en' ? draft : await readDraft(req, id, 'en')
    const advisories = english.title?.trim() ? [] : ['missing_english']
    const result = (status: 'missing_draft' | 'already_published' | 'ready' | 'published') => ({
      content: [{ type: 'text' as const, text: JSON.stringify({ id, locale, status, advisories }) }],
    })

    if (!draft.title?.trim()) return result('missing_draft')
    if (draft._status === 'published') return result('already_published')
    if (dryRun) return result('ready')

    const post = await req.payload.update({
      collection: 'posts',
      id,
      locale,
      draft: false,
      fallbackLocale: false,
      publishSpecificLocale: locale,
      publishAllLocales: false,
      data: { _status: 'published' },
      depth: 0,
      overrideAccess: false,
      overrideLock: false,
      req,
    })
    if (post._status !== 'published') throw new APIError(`Post ${id} could not be published in ${locale}.`, 409)

    return result('published')
  },
}
