import type { Payload } from 'payload'
import type { PlatformContentMedia, PlatformStaff } from '@/payload-types'
import { upsertByUniqueField } from '../seed-helpers'

import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'

/**
 * Seed three demo posts (ordered creation) and link relatedPosts circularly.
 * Caller ensures idempotency by pre-checking existing count.
 */
export async function seedPosts(
  payload: Payload,
  images: PlatformContentMedia[],
  author: PlatformStaff,
): Promise<void> {
  const p1Data = post1({ heroImage: images[0]!, blockImage: images[1]!, author: author })
  const p2Data = post2({ heroImage: images[1]!, blockImage: images[2]!, author: author })
  const p3Data = post3({ heroImage: images[2]!, blockImage: images[0]!, author: author })

  const p1 = await upsertByUniqueField(payload, 'posts', 'slug', p1Data)
  const p2 = await upsertByUniqueField(payload, 'posts', 'slug', p2Data)
  const p3 = await upsertByUniqueField(payload, 'posts', 'slug', p3Data)

  await payload.update({
    id: p1.doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [p2.doc.id, p3.doc.id],
    },
  })
  await payload.update({
    id: p2.doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [p1.doc.id, p3.doc.id],
    },
  })
  await payload.update({
    id: p3.doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [p1.doc.id, p2.doc.id],
    },
  })
}
