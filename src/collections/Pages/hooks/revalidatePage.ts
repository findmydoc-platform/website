import { localizedPublicationRevalidation } from '@/collections/common/localizedPublicationRevalidation'
import type { Page } from '@/payload-types'

export const {
  afterChange: revalidatePage,
  afterDelete: revalidateDelete,
  beforeChange: capturePageBeforeChange,
  beforeDelete: capturePageBeforeDelete,
} = localizedPublicationRevalidation<Page>('pages')
