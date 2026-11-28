import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

export function getPublicChromeCopy(locale: UiCopyLocale) {
  const t = createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.chrome',
  })

  return {
    nav: {
      main: t('navigation.main'),
      mobile: t('navigation.mobile'),
      open: t('navigation.open'),
      close: t('navigation.close'),
    },
    labels: {
      '/about': t('navigation.about'),
      '/contact': t('navigation.contact'),
      '/listing-comparison': t('navigation.comparison'),
      '/partners/clinics': t('navigation.clinicPartners'),
      '/register/clinic': t('navigation.clinicApplication'),
      '/admin/login': t('navigation.staffLogin'),
      '/posts': t('navigation.blog'),
      '/privacy-policy': t('navigation.privacy'),
      '/imprint': t('navigation.imprint'),
    },
    preview: { label: t('preview.label'), description: t('preview.description') },
    footer: {
      main: t('footer.main'),
      legal: t('footer.legal'),
      description: t('footer.description'),
      disclaimer: t('footer.disclaimer'),
      copyright: t('footer.copyright', { year: new Date().getFullYear() }),
    },
    footerGroups: {
      About: t('footer.about'),
      Services: t('footer.services'),
      Information: t('footer.information'),
    },
    account: {
      signIn: t('account.signIn'),
      openGuest: t('account.openGuest'),
      openPatient: (name: string) => t('account.openPatient', { name }),
      title: t('account.title'),
      description: t('account.description'),
      patientLogin: t('account.patientLogin'),
      registerPatient: t('account.registerPatient'),
      inquiries: t('account.inquiries'),
      favorites: t('account.favorites'),
      profile: t('account.profile'),
      signOut: t('account.signOut'),
      clinicPartners: t('navigation.clinicPartners'),
    },
  }
}
