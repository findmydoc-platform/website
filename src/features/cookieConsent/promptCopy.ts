import type { CookieConsentBannerContent } from './types'

export const APPROVED_COOKIE_CONSENT_PROMPT = {
  en: {
    title: 'Help us improve findmydoc',
    description:
      'With your consent, we analyse page views and clicks, detect technical errors and record browsing sessions. This helps us identify where findmydoc is difficult to use. You can use the website without this analysis and change your choice at any time in Cookie settings.',
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    customizeLabel: 'Settings',
  },
  de: {
    title: 'Hilf uns, findmydoc zu verbessern',
    description:
      'Mit deiner Einwilligung werten wir Seitenaufrufe und Klicks aus, erkennen technische Fehler und zeichnen Nutzungssitzungen auf. So erkennen wir, wo findmydoc schwer zu bedienen ist. Du kannst die Website auch ohne diese Auswertung nutzen und deine Auswahl jederzeit in den Cookie-Einstellungen ändern.',
    acceptLabel: 'Alle akzeptieren',
    rejectLabel: 'Alle ablehnen',
    customizeLabel: 'Einstellungen',
  },
} satisfies Record<'en' | 'de', CookieConsentBannerContent>
