import type { Payload } from 'payload'
import type { Media, PlatformStaff } from '@/payload-types'

import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'

export async function seedPosts(payload: Payload, images: Media[], author: PlatformStaff): Promise<void> {
  // Do not create posts with `Promise.all` because we want the posts to be created in order
  // This way we can sort them by `createdAt` or `publishedAt` and they will be in the expected order
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

  // update each post with related posts
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
