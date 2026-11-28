import { getTranslations } from 'next-intl/server'

import type { FormCopy } from '@/components/organisms/Form/copy'
import type { ContentLocale } from '@/utilities/contentLocalization'

export async function cmsFormCopy(locale: ContentLocale): Promise<FormCopy> {
  const translate = await getTranslations({ locale, namespace: 'cmsForm' })
  return {
    required: translate('required'),
    requiredCue: translate('requiredCue'),
    invalidEmail: translate('invalidEmail'),
    invalidValue: translate('invalidValue'),
    pending: translate('pending'),
    success: translate('success'),
    failure: translate('failure'),
    submit: translate('submit'),
  }
}
