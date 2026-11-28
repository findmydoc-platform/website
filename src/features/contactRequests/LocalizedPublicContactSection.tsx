import type { PublicContactSectionProps } from '@/components/organisms/Contact'
import { publicContactCopy } from '@/features/uiCopy/publicContact'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import { FormBridgePublicContactSectionAdapter } from './FormBridgePublicContactSectionAdapter.client'

type Props = {
  locale: UiCopyLocale
} & Pick<PublicContactSectionProps, 'headingAs' | 'submissionMetadata'> &
  Partial<Pick<PublicContactSectionProps, 'title' | 'description'>>

export async function LocalizedPublicContactSection({ locale, title, description, ...props }: Props) {
  const copy = await publicContactCopy(locale)

  return (
    <FormBridgePublicContactSectionAdapter
      {...copy}
      {...props}
      title={title ?? copy.title}
      description={description ?? copy.description}
    />
  )
}
