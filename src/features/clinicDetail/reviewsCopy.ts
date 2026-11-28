import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

import { getClinicProfileTranslator } from './overviewCopy'

function createClinicReviewsCopy(locale: UiCopyLocale) {
  const t = createTranslator({
    locale,
    messages: {
      reviews: (locale === 'de' ? germanMessages : englishMessages).website.clinicProfile.reviews,
    },
    namespace: 'reviews',
  })
  const profile = getClinicProfileTranslator(locale)
  const dates = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  })
  const ratings = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  return {
    heading: t('heading'),
    verifiedCount: (count: number) => t('verifiedCount', { count }),
    verifiedInfoLabel: t('verifiedInfoLabel'),
    verifiedInfo: t('verifiedInfo'),
    verifiedReview: t('verifiedReview'),
    anonymous: t('anonymous'),
    patient: t('patient'),
    clinicResponse: t('clinicResponse'),
    expandResponse: t('expandResponse'),
    collapseResponse: t('collapseResponse'),
    moderationLabel: t('moderationLabel'),
    unavailableLabel: t('unavailableLabel'),
    moderationRedaction: t('moderationRedaction'),
    moderationPlaceholder: t('moderationPlaceholder'),
    originalWording: t('originalWording'),
    contextWording: t('contextWording'),
    itemLabel: (author: string, date: string, placeholder: boolean) =>
      t(placeholder ? 'placeholderItemLabel' : 'itemLabel', { author, date }),
    latest: t('latest'),
    onlyVerified: t('onlyVerified'),
    empty: t('empty'),
    emptyDescription: t('emptyDescription'),
    preparing: t('preparing'),
    preparingDescription: t('preparingDescription'),
    preparingCount: (count: number) => t('preparingCount', { count }),
    progress: (visible: number, total: number, hasMore: boolean) =>
      t(hasMore ? 'partialProgress' : 'progress', { visible, total }),
    emptyCount: (count: number) => t('emptyCount', { count }),
    listHeading: t('listHeading'),
    showMore: t('showMore'),
    showMoreHint: (count: number) => t('showMoreHint', { count }),
    form: {
      heading: t('form.heading'),
      signIn: t('form.signIn'),
      loginPrompt: t('form.loginPrompt'),
      unavailable: t('form.unavailable'),
      doctor: t('form.doctor'),
      treatment: t('form.treatment'),
      rating: t('form.rating'),
      comment: t('form.comment'),
      chooseDoctor: t('form.chooseDoctor'),
      chooseTreatment: t('form.chooseTreatment'),
      chooseRating: t('form.chooseRating'),
      enterComment: t('form.enterComment'),
      allowName: t('form.allowName'),
      submit: t('form.submit'),
      submitting: t('form.submitting'),
      success: t('form.success'),
      reauthenticate: t('form.reauthenticate'),
      invalid: t('form.invalid'),
      failed: t('form.failed'),
    },
    ratingLabel: (value: number) => profile('trust.ratingValue', { rating: ratings.format(value) }),
    formatRating: (value: number) => ratings.format(value),
    formatDate: (value: string) => {
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : dates.format(date)
    },
  }
}

export type ClinicReviewsCopy = ReturnType<typeof createClinicReviewsCopy>

const copy = {
  de: createClinicReviewsCopy('de'),
  en: createClinicReviewsCopy('en'),
}
export function getClinicReviewsCopy(locale: UiCopyLocale): ClinicReviewsCopy {
  return copy[locale]
}
