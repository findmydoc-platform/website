import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  Payload,
  PayloadRequest,
  RequiredDataFromCollectionSlug,
} from 'payload'

import type { Page, Redirect } from '@/payload-types'
import {
  LEGACY_LEGAL_REDIRECTS,
  MANAGED_LEGAL_PAGE_SPECS,
  REMOVED_LEGAL_PATHS,
  getManagedLegalPageSpec,
  isManagedLegalPageSlug,
} from '@/utilities/legalPages'

type ManagedPageDoc = Pick<Page, 'id' | 'slug' | '_status' | 'deletedAt'>
type RedirectDoc = Pick<Redirect, 'id' | 'from' | 'to'>
type PageMutation = Partial<RequiredDataFromCollectionSlug<'pages'>> & Record<string, unknown>

function buildLexicalTextNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal' as const,
    style: '',
    text,
    type: 'text' as const,
    version: 1,
  }
}

function buildLexicalParagraph(text: string) {
  return {
    children: [buildLexicalTextNode(text)],
    direction: 'ltr' as const,
    format: '',
    indent: 0,
    type: 'paragraph' as const,
    version: 1,
  }
}

function buildLexicalHeading(text: string) {
  return {
    children: [buildLexicalTextNode(text)],
    direction: 'ltr' as const,
    format: '',
    indent: 0,
    tag: 'h2' as const,
    type: 'heading' as const,
    version: 1,
  }
}

function buildManagedLegalPageLayout(title: string, body: string): NonNullable<Page['layout']> {
  return [
    {
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: {
            root: {
              type: 'root',
              children: [buildLexicalHeading(title), buildLexicalParagraph(body)],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          },
        },
      ],
    },
  ]
}

function buildManagedLegalPageData(
  spec: (typeof MANAGED_LEGAL_PAGE_SPECS)[number],
): RequiredDataFromCollectionSlug<'pages'> {
  const timestamp = new Date().toISOString()

  return {
    title: spec.title,
    slug: spec.slug,
    generateSlug: false,
    _status: 'published',
    publishedAt: timestamp,
    meta: {
      title: spec.title,
      description: spec.metaDescription,
    },
    layout: buildManagedLegalPageLayout(spec.title, spec.placeholderBody),
  }
}

async function findManagedPageBySlug(payload: Payload, slug: string): Promise<ManagedPageDoc | null> {
  const result = await payload.find({
    collection: 'pages',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
    trash: true,
  })

  return (result.docs[0] as ManagedPageDoc | undefined) ?? null
}

async function createManagedPage(payload: Payload, spec: (typeof MANAGED_LEGAL_PAGE_SPECS)[number]) {
  try {
    return await payload.create({
      collection: 'pages',
      data: buildManagedLegalPageData(spec),
      draft: false,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
        disableSearchSync: true,
      },
    })
  } catch (error) {
    const concurrentDoc = await findManagedPageBySlug(payload, spec.slug)

    if (concurrentDoc) {
      return concurrentDoc
    }

    throw error
  }
}

async function ensureManagedPage(payload: Payload, spec: (typeof MANAGED_LEGAL_PAGE_SPECS)[number]) {
  const existing = (await findManagedPageBySlug(payload, spec.slug)) ?? (await createManagedPage(payload, spec))

  const update: PageMutation = {}

  if (existing._status !== 'published') {
    update._status = 'published'
    update.publishedAt = new Date().toISOString()
  }

  if (existing.deletedAt) {
    update.deletedAt = null
  }

  if (Object.keys(update).length === 0) {
    return
  }

  await payload.update({
    collection: 'pages',
    id: existing.id,
    data: update,
    overrideAccess: true,
    trash: true,
    context: {
      disableRevalidate: true,
      disableSearchSync: true,
    },
  })
}

async function findRedirectsByFrom(payload: Payload, from: string): Promise<RedirectDoc[]> {
  const result = await payload.find({
    collection: 'redirects',
    where: {
      from: {
        equals: from,
      },
    },
    limit: 10,
    pagination: false,
    overrideAccess: true,
  })

  return result.docs as RedirectDoc[]
}

async function ensureRedirect(payload: Payload, from: string, to: string) {
  const redirects = await findRedirectsByFrom(payload, from)
  let [primary, ...duplicates] = redirects

  if (!primary) {
    try {
      await payload.create({
        collection: 'redirects',
        data: {
          from,
          to: {
            type: 'custom',
            url: to,
          },
        },
        overrideAccess: true,
        context: {
          disableRevalidate: true,
        },
      })
    } catch (error) {
      const concurrentRedirects = await findRedirectsByFrom(payload, from)

      if (concurrentRedirects.length === 0) {
        throw error
      }

      ;[primary, ...duplicates] = concurrentRedirects
    }

    if (!primary) {
      return
    }
  }

  if (primary.to?.type !== 'custom' || primary.to?.url !== to) {
    await payload.update({
      collection: 'redirects',
      id: primary.id,
      data: {
        from,
        to: {
          type: 'custom',
          url: to,
        },
      },
      overrideAccess: true,
      context: {
        disableRevalidate: true,
      },
    })
  }

  for (const duplicate of duplicates) {
    await payload.delete({
      collection: 'redirects',
      id: duplicate.id,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
      },
    })
  }
}

async function removeRedirect(payload: Payload, from: string) {
  const redirects = await findRedirectsByFrom(payload, from)

  for (const redirect of redirects) {
    await payload.delete({
      collection: 'redirects',
      id: redirect.id,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
      },
    })
  }
}

export async function ensureManagedLegalContent(payload: Payload) {
  if (ensureManagedLegalContentPromise) {
    await ensureManagedLegalContentPromise
    return
  }

  ensureManagedLegalContentPromise = (async () => {
    for (const spec of MANAGED_LEGAL_PAGE_SPECS) {
      await ensureManagedPage(payload, spec)
    }

    for (const redirect of LEGACY_LEGAL_REDIRECTS) {
      await ensureRedirect(payload, redirect.from, redirect.to)
    }

    for (const removedPath of REMOVED_LEGAL_PATHS) {
      await removeRedirect(payload, removedPath)
    }
  })()

  try {
    await ensureManagedLegalContentPromise
  } finally {
    ensureManagedLegalContentPromise = null
  }
}

let ensureManagedLegalContentPromise: Promise<void> | null = null

function resolveManagedLegalSpec(data: Record<string, unknown>, originalDoc?: Partial<Page> | null) {
  const incomingSlug = typeof data.slug === 'string' ? data.slug : null
  const existingSlug = typeof originalDoc?.slug === 'string' ? originalDoc.slug : null

  return getManagedLegalPageSpec(existingSlug ?? incomingSlug)
}

export const enforceManagedLegalPagesBeforeChange: CollectionBeforeChangeHook<Page> = async ({
  data,
  operation,
  originalDoc,
}) => {
  const draft = { ...(data || {}) } as Record<string, unknown>
  const spec = resolveManagedLegalSpec(draft, originalDoc)

  if (!spec) {
    return draft
  }

  if (operation === 'update') {
    if (typeof draft.slug === 'string' && draft.slug !== spec.slug) {
      throw new Error(`${spec.title} must keep the slug "${spec.slug}"`)
    }

    if (draft._status === 'draft') {
      throw new Error(`${spec.title} must remain published`)
    }

    draft.slug = spec.slug
    return draft
  }

  if (draft._status === 'draft') {
    throw new Error(`${spec.title} must be published when created`)
  }

  return draft
}

async function findPageForDeletion(req: PayloadRequest, id: number | string) {
  const doc = await req.payload.findByID({
    collection: 'pages',
    id,
    req,
    overrideAccess: true,
  })

  return doc as Pick<Page, 'slug' | 'title'> | null
}

export const preventManagedLegalPageDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const page = await findPageForDeletion(req, id)

  if (!isManagedLegalPageSlug(page?.slug)) {
    return
  }

  const label = typeof page?.title === 'string' && page.title.length > 0 ? page.title : page.slug
  throw new Error(`${label} is a required legal page and cannot be deleted`)
}
