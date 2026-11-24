import { localizedPublicationRevalidation } from '@/collections/common/localizedPublicationRevalidation'
import type { Post } from '@/payload-types'

export const {
  afterChange: revalidatePost,
  afterDelete: revalidateDelete,
  beforeChange: capturePostBeforeChange,
  beforeDelete: capturePostBeforeDelete,
  beforeOperation: capturePostDraftSaveIntent,
} = localizedPublicationRevalidation<Post>('posts')
