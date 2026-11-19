import { getTranslations } from 'next-intl/server'

export async function patientLoginCopy() {
  const translate = await getTranslations('auth.patientLogin')
  return { title: translate('title') }
}
