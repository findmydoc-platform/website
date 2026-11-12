import { describe, expect, it } from 'vitest'

import {
  getTemporaryLandingBlogCopy,
  getTemporaryLandingPageContent,
  TEMPORARY_LANDING_LOCALES,
  type TemporaryLandingLocale,
} from '@/features/temporaryLandingMode'

const expectedLocalizedCopyByLocale = {
  en: {
    eyebrow: 'For patients and clinics',
    subheadlineText:
      'Structured clinic profiles and transparent quality signals - so patients can compare faster and clinics receive suitable inquiries.',
    title: 'Better matches for treatments abroad.',
    description:
      'findmydoc brings together patient reviews and quality indicators in one place - transparent, comparable, easy to understand.',
    whatYouGetEyebrow: 'WHAT TO EXPECT',
    signals: [
      {
        title: 'Structured comparison',
        body: 'Consistent profiles make clinics and treatments easier to compare.',
      },
      {
        title: 'Trust through transparency',
        body: 'Quality signals help put options into context and set clearer expectations.',
      },
      {
        title: 'Clearer first contact',
        body: 'Patients reach suitable clinics faster - clinics receive better-matched inquiries.',
      },
    ],
    narrative:
      'I believe medical decisions must not depend on gut feeling or information chaos. That is why we make options understandable and comparable - with clear criteria, real facts, and guidance. findmydoc helps patients from the DACH region find suitable clinics abroad with more confidence.\n\nI believe trust emerges when expectations are realistic and next steps become clear. That is why we structure information, explain differences, and give you a clear logic for comparison. findmydoc makes it easier to compare clinics and treatments in a focused way and reach out well prepared.',
  },
  de: {
    eyebrow: 'Wer schön sein will muss vergleichen.',
    subheadlineText:
      'Strukturierte Klinikprofile und transparente Qualitäts-Signale - damit du die passende Klinik mit mehr Vertrauen findest.',
    title: 'Eine Vergleichs\u00adplattform für Schönheits\u00adkliniken.',
    description:
      'findmydoc bündelt Erfahrungsberichte und Qualitätsindikatoren an einem Ort - transparent, vergleichbar, verständlich.',
    whatYouGetEyebrow: 'DAS ERWARTET DICH',
    signals: [
      {
        title: 'Kliniken strukturiert vergleichen',
        body: 'Behandlungen, Spezialisierungen und relevante Profilinfos übersichtlich und transparent nebeneinander sehen, bevor du Kontakt aufnimmst.',
      },
      {
        title: 'Mehr Vertrauen durch Qualitäts-Signale',
        body: 'Transparente Indikatoren helfen dir, Optionen besser einzuordnen und Erwartungen realistischer zu setzen.',
      },
      {
        title: 'Direkter nächster Schritt',
        body: 'Wenn es passt, kannst du gezielt anfragen und die nächsten Schritte anhand deiner Bedürfnisse klären.',
      },
    ],
    narrative:
      'Ich glaube, medizinische Entscheidungen dürfen nicht vom Bauchgefühl oder von Informationschaos abhängen. Deshalb machen wir Optionen verständlich und vergleichbar – mit klaren Kriterien, echten Fakten und Orientierung. findmydoc hilft Patient:innen aus der DACH-Region, passende Kliniken im Ausland mit mehr Sicherheit zu finden.\n\nIch glaube, Vertrauen entsteht, wenn Erwartungen realistisch sind und nächste Schritte klar werden. Deshalb strukturieren wir Informationen, erklären Unterschiede und geben dir eine klare Vergleichslogik an die Hand. findmydoc macht es einfacher, Kliniken und Behandlungen gezielt zu vergleichen und vorbereitet anzufragen.',
  },
  tr: {
    eyebrow: 'Türkiye’deki estetik klinikleri için',
    subheadlineText:
      'Yapılandırılmış klinik profilleri ve anlaşılır kalite göstergeleriyle görünür olun, kliniğinize uygun talepler alın.',
    title: 'Avrupa’dan daha fazla nitelikli talep',
    description:
      'findmydoc, deneyim paylaşımlarını ve kalite göstergelerini tek bir yerde, şeffaf, anlaşılır ve karşılaştırılabilir bir biçimde sunar.',
    whatYouGetEyebrow: 'Sizi neler bekliyor?',
    signals: [
      {
        title: 'Daha fazla görünürlük',
        body: 'Hastaların aktif olarak karşılaştırma yaptığı yerde, güven veren bir profille keşfedilin.',
      },
      {
        title: 'Dönüşüm sağlayan bir profil',
        body: 'Standartlaştırılmış bilgiler belirsizlikleri azaltır ve ilk görüşmelerin kalitesini artırır.',
      },
      {
        title: 'Daha nitelikli talepler',
        body: 'Daha uygun hastalar, daha odaklı sorular ve randevuya kadar daha verimli bir süreç.',
      },
    ],
    narrative:
      'İyi kliniklerin seslerini yükseltmeye değil, daha iyi anlaşılmaya ihtiyacı olduğuna inanıyorum. Bu yüzden standartlaştırılmış klinik profilleri, açık ve anlaşılır bilgiler ve güven veren bir sunumla kliniklerin kendilerini tanıtabilecekleri bir alan oluşturuyoruz. findmydoc, Türkiye’deki kliniklerin Almanya, Avusturya ve İsviçre’den kendilerine uygun hastalar tarafından bulunmasına yardımcı olur.\n\nEn iyi eşleşmenin, her iki tarafın da en başından birbirini doğru anlamasıyla başladığına inanıyorum. Bu yüzden açık bilgiler ve daha net bir ilk iletişimle beklenti yönetimini iyileştiriyoruz. findmydoc, kliniklere daha uygun talepler, hastalara ise kendilerine uygun seçeneğe ulaşmak için daha verimli bir yol sunar.',
  },
} satisfies Record<
  TemporaryLandingLocale,
  {
    description: string
    eyebrow: string
    narrative: string
    signals: { body: string; title: string }[]
    subheadlineText: string
    title: string
    whatYouGetEyebrow: string
  }
>

describe('temporaryLandingMode content', () => {
  it('returns non-empty hero copy for every supported locale', () => {
    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = getTemporaryLandingPageContent(locale)

      expect(content.eyebrow.trim().length).toBeGreaterThan(0)
      expect(content.title.trim().length).toBeGreaterThan(0)
      expect(content.description.trim().length).toBeGreaterThan(0)
      expect(content.heroVideo?.subheadlineText?.trim().length ?? 0).toBeGreaterThan(0)
    })
  })

  it('returns three benefit cards with localized copy for every locale', () => {
    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = getTemporaryLandingPageContent(locale)

      expect(content.whatYouGetEyebrow?.trim().length ?? 0).toBeGreaterThan(0)
      expect(content.signals).toHaveLength(3)
      content.signals.forEach((signal) => {
        expect(signal.title.trim().length).toBeGreaterThan(0)
        expect(signal.body.trim().length).toBeGreaterThan(0)
      })
    })
  })

  it('maps the planned locale-specific headline anchors', () => {
    expect(getTemporaryLandingPageContent('en').title).toBe('Better matches for treatments abroad.')
    expect(getTemporaryLandingPageContent('de').title).toBe(
      'Eine Vergleichs\u00adplattform für Schönheits\u00adkliniken.',
    )
    expect(getTemporaryLandingPageContent('tr').title).toBe('Avrupa’dan daha fazla nitelikli talep')
  })

  it('returns the expected locale-specific copy for the visible landing content', () => {
    TEMPORARY_LANDING_LOCALES.forEach((locale) => {
      const content = getTemporaryLandingPageContent(locale)
      const expected = expectedLocalizedCopyByLocale[locale]

      expect(content.eyebrow).toBe(expected.eyebrow)
      expect(content.heroVideo?.subheadlineText).toBe(expected.subheadlineText)
      expect(content.title).toBe(expected.title)
      expect(content.description).toBe(expected.description)
      expect(content.whatYouGetEyebrow).toBe(expected.whatYouGetEyebrow)
      expect(
        content.signals.map((signal) => ({
          title: signal.title,
          body: signal.body,
        })),
      ).toEqual(expected.signals)
      expect(content.narrative).toBe(expected.narrative)
    })
  })

  it('falls back to english content for unsupported locale keys', () => {
    const invalidLocale = 'xx' as TemporaryLandingLocale
    const fallbackContent = getTemporaryLandingPageContent(invalidLocale)

    expect(fallbackContent.title).toBe(getTemporaryLandingPageContent('en').title)
    expect(fallbackContent.searchSnapshot.metaTitle).toBe(getTemporaryLandingPageContent('en').searchSnapshot.metaTitle)
  })

  it('returns localized blog teaser copy for every holding locale', () => {
    expect(getTemporaryLandingBlogCopy('en')).toMatchObject({
      ctaLabel: 'View all articles',
      title: 'Latest insights',
    })
    expect(getTemporaryLandingBlogCopy('de')).toMatchObject({
      ctaLabel: 'Alle Beiträge ansehen',
      title: 'Aktuelle Einblicke',
    })
    expect(getTemporaryLandingBlogCopy('tr')).toMatchObject({
      ctaLabel: 'Tüm yazıları görüntüle',
      title: 'Güncel bilgiler',
    })
  })
})
