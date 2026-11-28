import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import { CLINIC_PARTNER_PATHS } from '@/i18n/editorialLandingPaths'
import { CONTACT_PATHS } from '@/i18n/contactPath'
import { LISTING_COMPARISON_PATHS } from '@/i18n/listingComparisonPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

export function getAboutPageCopy(locale: UiCopyLocale) {
  const t = createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.aboutPage',
  })

  const comparison = {
    href: LISTING_COMPARISON_PATHS[locale],
    label: t('compare'),
    appearance: 'accent',
  } as const
  const clinics = { href: CLINIC_PARTNER_PATHS[locale], appearance: 'secondary' } as const

  return {
    contact: { href: CONTACT_PATHS[locale], label: t('contact') },
    heroActions: [comparison, { ...clinics, label: t('forClinics') }],
    signal: {
      intro: t('signalIntro'),
      items: [
        { label: t('signal1Label'), title: t('signal1Title'), tone: 'primary' },
        { label: t('signal2Label'), title: t('signal2Title'), tone: 'accent' },
        { label: t('signal3Label'), title: t('signal3Title'), tone: 'secondary' },
      ] as const,
    },
    boundary: {
      intro: t('boundaryIntro'),
      items: [
        { label: t('boundary1Label'), title: t('boundary1Title') },
        { label: t('boundary2Label'), title: t('boundary2Title') },
        { label: t('boundary3Label'), title: t('boundary3Title') },
      ] as const,
    },
    closing: {
      intro: t('nextStep'),
      title: t('closingTitle'),
      description: t('closingDescription'),
      actions: [comparison, { ...clinics, label: t('apply') }] as const,
    },
    team: {
      intro: t('teamIntro'),
      title: t('teamTitle'),
      rolesLabel: t('teamRoles'),
      defaultRole: t('teamRoleFallback'),
      decision: t('defaultDecision'),
      protection: t('defaultProtection'),
      rows: [
        { key: 'owns', label: t('owns'), tone: 'primary' },
        { key: 'decisionBoundary', label: t('decisionBoundary'), tone: 'accent' },
        { key: 'protects', label: t('protects'), tone: 'secondary' },
      ] as const,
      members: [
        {
          label: t('teamRole1'),
          owns: t('team1Owns'),
          decisionBoundary: t('team1DecisionBoundary'),
          protects: t('team1Protects'),
        },
        {
          label: t('teamRole2'),
          owns: t('team2Owns'),
          decisionBoundary: t('team2DecisionBoundary'),
          protects: t('team2Protects'),
        },
        {
          label: t('teamRole3'),
          owns: t('team3Owns'),
          decisionBoundary: t('team3DecisionBoundary'),
          protects: t('team3Protects'),
        },
        {
          label: t('teamRole4'),
          owns: t('team4Owns'),
          decisionBoundary: t('team4DecisionBoundary'),
          protects: t('team4Protects'),
        },
        {
          label: t('teamRole5'),
          owns: t('team5Owns'),
          decisionBoundary: t('team5DecisionBoundary'),
          protects: t('team5Protects'),
        },
      ],
    },
    story: {
      heading: t('storyHeading'),
      cards: [
        { tone: 'primary', label: t('storyWhy'), title: t('storyWhyTitle'), body: t('storyWhyBody'), mission: null },
        { tone: 'accent', label: t('storyHow'), title: t('storyHowTitle'), body: t('storyHowBody'), mission: null },
        {
          tone: 'secondary',
          label: t('storyWhat'),
          title: t('storyWhatTitle'),
          body: t('storyWhatBody'),
          mission: { title: t('missionTitle'), body: t('missionBody') },
        },
      ] as const,
      signals: [t('verification'), t('transparency'), t('access'), t('privacy')] as const,
      rings: [t('saferDecisions'), t('verifiedEvidence'), t('compareRequest')] as const,
      patientConfidence: t('patientConfidence'),
      trustAtCore: t('trustAtCore'),
      noScript: t('noScript'),
    },
  }
}

export type AboutPageCopy = ReturnType<typeof getAboutPageCopy>
