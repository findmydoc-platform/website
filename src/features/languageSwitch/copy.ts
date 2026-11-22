import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

const de = createTranslator({ locale: 'de', messages: germanMessages, namespace: 'auth.languageSwitch' })
const en = createTranslator({ locale: 'en', messages: englishMessages, namespace: 'auth.languageSwitch' })

// The labels and names are published. The rest of the switcher copy needs a shared catalog release.
export const languageSwitcherCopy = {
  de: {
    label: de('label'),
    name: en('alternate'),
    unavailable: 'Diese Seite ist auf Deutsch noch nicht verfügbar.',
    confirmTitle: 'Sprache wechseln?',
    confirmDescription: 'Beim Sprachwechsel können Eingaben verloren gehen.',
    stay: 'Im Formular bleiben',
    confirmSwitch: 'Trotzdem zu Englisch wechseln',
    close: 'Schließen',
  },
  en: {
    label: en('label'),
    name: de('alternate'),
    unavailable: 'This page isn’t available in English yet.',
    confirmTitle: 'Switch language?',
    confirmDescription: 'Your entries may be lost when you switch languages.',
    stay: 'Stay on this form',
    confirmSwitch: 'Switch to German anyway',
    close: 'Close',
  },
} satisfies Record<UiCopyLocale, Record<string, string>>
