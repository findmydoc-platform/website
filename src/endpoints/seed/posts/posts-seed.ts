import type { Payload } from 'payload'
import type { Media, PlatformStaff } from '@/payload-types'

import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'

/**
 * Seed three demo posts (ordered creation) and link relatedPosts circularly.
 * Caller ensures idempotency by pre-checking existing count.
 */
export async function seedPosts(payload: Payload, images: Media[], author: PlatformStaff): Promise<void> {
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post1({ heroImage: images[0]!, blockImage: images[1]!, author: author }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post2({ heroImage: images[1]!, blockImage: images[2]!, author: author }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post3({ heroImage: images[2]!, blockImage: images[0]!, author: author }),
  })

  await payload.update({
    id: post1Doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [post2Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post2Doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [post1Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post3Doc.id,
    collection: 'posts',
    context: { disableRevalidate: true },
    data: {
      relatedPosts: [post1Doc.id, post2Doc.id],
    },
  })
}
