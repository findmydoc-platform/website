import { buildRichText } from './richText'

export const localizedFormScenario = {
  de: {
    title: 'Formulartest auf Deutsch',
    name: 'Beispielname',
    category: 'Thema auswählen',
    categoryPrompt: 'Wähle ein Thema',
    option: 'Technische Frage',
    hint: 'Dieses Beispiel speichert ausschließlich Testdaten.',
    confirmation: 'Die Testantwort wurde gespeichert.',
    returnLabel: 'Zur Kontaktseite',
    returnHref: '/contact',
    submit: 'Testantwort senden',
  },
  en: {
    title: 'Form test in English',
    name: 'Example name',
    category: 'Select a topic',
    categoryPrompt: 'Choose a topic',
    option: 'Technical question',
    hint: 'This example stores synthetic data only.',
    confirmation: 'The test response was saved.',
    returnLabel: 'Back to contact',
    returnHref: '/en/contact',
    submit: 'Send test answer',
  },
} as const

export function localizedFormConfirmation(locale: keyof typeof localizedFormScenario) {
  const copy = localizedFormScenario[locale]
  const confirmation = buildRichText(copy.confirmation)
  return {
    root: {
      ...confirmation.root,
      children: [
        ...confirmation.root.children,
        {
          type: 'paragraph',
          version: 1,
          children: [
            {
              type: 'link',
              version: 3,
              fields: { linkType: 'custom', newTab: false, url: copy.returnHref },
              children: [{ type: 'text', version: 1, text: copy.returnLabel }],
            },
          ],
        },
      ],
    },
  }
}
