import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import { ArrowLeftRight, ShieldCheck, UserRoundSearch } from 'lucide-react'

import { TEMPORARY_LANDING_DEFAULT_LOCALE, type TemporaryLandingLocale } from './i18n'

type TemporaryLandingCopy = {
  contactConsent: string
  contactDescription: string
  contactEyebrow: string
  contactFormLabels: HoldingPageConceptProps['contactFormLabels']
  contactTitle: string
  description: string
  eyebrow: string
  footerImprintLabel: string
  footerPrivacyLabel: string
  internalLinkClinicQualitySignals: string
  internalLinkCompareClinics: string
  internalLinkTreatmentGuides: string
  mediaBadge: string
  mediaDescription: string
  mediaTitle: string
  metaDescription: string
  metaTitle: string
  narrative: string
  primaryCtaLabel: string
  searchIntent: string
  signalContactBody: string
  signalContactTitle: string
  signalTrustBody: string
  signalTrustTitle: string
  signalVerifyBody: string
  signalVerifyTitle: string
  statusLabel: string
  subheadlineText: string
  title: string
  whatYouGetEyebrow: string
  whySectionEyebrow: string
  whySectionHeading: string
}

const copyByLocale: Record<TemporaryLandingLocale, TemporaryLandingCopy> = {
  en: {
    contactConsent: 'By sending this request, you agree that findmydoc may contact you about your inquiry.',
    contactDescription:
      'Use this contact form to send us a direct request. Include a short title, your message, and your email so we can reply.',
    contactEyebrow: 'Contact',
    contactFormLabels: {
      emailPlaceholder: 'Email',
      emailRequiredMessage: 'Email is required.',
      genericErrorMessage: 'Could not send your request right now.',
      messagePlaceholder: 'Message',
      messageRequiredMessage: 'Message is required.',
      namePlaceholder: 'Name',
      nameRequiredMessage: 'Name is required.',
      submittingLabel: 'Sending...',
      successMessage: 'Your request has been sent successfully.',
    },
    contactTitle: 'Contact us',
    description:
      'findmydoc brings together patient reviews and quality indicators in one place - transparent, comparable, easy to understand.',
    eyebrow: 'For patients and clinics',
    footerImprintLabel: 'Imprint',
    footerPrivacyLabel: 'Privacy Policy',
    internalLinkClinicQualitySignals: 'Clinic quality signals explained',
    internalLinkCompareClinics: 'Compare clinics by treatment',
    internalLinkTreatmentGuides: 'Medical travel treatment guides',
    mediaBadge: 'Verified comparison',
    mediaDescription:
      'A calm, high-quality video backdrop supports readability while keeping the focus on trust and informed treatment decisions.',
    mediaTitle: 'Trusted clinic comparison starts with clear information.',
    metaDescription:
      'Structured clinic profiles and transparent quality signals - so patients can compare faster and clinics receive suitable inquiries.',
    metaTitle: 'findmydoc | Better matches for treatments abroad.',
    narrative:
      'I believe medical decisions must not depend on gut feeling or information chaos. That is why we make options understandable and comparable - with clear criteria, real facts, and guidance. findmydoc helps patients from the DACH region find suitable clinics abroad with more confidence.\n\nI believe trust emerges when expectations are realistic and next steps become clear. That is why we structure information, explain differences, and give you a clear logic for comparison. findmydoc makes it easier to compare clinics and treatments in a focused way and reach out well prepared.',
    primaryCtaLabel: 'Get in touch',
    searchIntent: 'Comparative with trust-focused launch intent',
    signalContactBody: 'Patients reach suitable clinics faster - clinics receive better-matched inquiries.',
    signalContactTitle: 'Clearer first contact',
    signalTrustBody: 'Quality signals help put options into context and set clearer expectations.',
    signalTrustTitle: 'Trust through transparency',
    signalVerifyBody: 'Consistent profiles make clinics and treatments easier to compare.',
    signalVerifyTitle: 'Structured comparison',
    statusLabel: 'Coming Soon',
    subheadlineText:
      'Structured clinic profiles and transparent quality signals - so patients can compare faster and clinics receive suitable inquiries.',
    title: 'Better matches for treatments abroad.',
    whatYouGetEyebrow: 'WHAT TO EXPECT',
    whySectionEyebrow: 'Founders vision',
    whySectionHeading: 'Patients from the DACH region',
  },
  de: {
    contactConsent: 'Mit dem Absenden stimmst du zu, dass findmydoc dich zu deiner Anfrage kontaktieren darf.',
    contactDescription:
      'Nutze dieses Kontaktformular für eine direkte Anfrage. Gib einen kurzen Titel, deine Nachricht und deine E-Mail an, damit wir antworten können.',
    contactEyebrow: 'Kontakt',
    contactFormLabels: {
      emailPlaceholder: 'E-Mail',
      emailRequiredMessage: 'E-Mail ist erforderlich.',
      genericErrorMessage: 'Deine Anfrage konnte gerade nicht gesendet werden.',
      messagePlaceholder: 'Nachricht',
      messageRequiredMessage: 'Nachricht ist erforderlich.',
      namePlaceholder: 'Name',
      nameRequiredMessage: 'Name ist erforderlich.',
      submittingLabel: 'Wird gesendet...',
      successMessage: 'Deine Anfrage wurde erfolgreich gesendet.',
    },
    contactTitle: 'Kontaktiere uns',
    description:
      'findmydoc bündelt Erfahrungsberichte und Qualitätsindikatoren an einem Ort - transparent, vergleichbar, verständlich.',
    eyebrow: 'Wer schön sein will muss vergleichen.',
    footerImprintLabel: 'Impressum',
    footerPrivacyLabel: 'Datenschutz',
    internalLinkClinicQualitySignals: 'Qualitätsmerkmale von Kliniken erklärt',
    internalLinkCompareClinics: 'Kliniken nach Behandlung vergleichen',
    internalLinkTreatmentGuides: 'Leitfäden für medizinische Reisen',
    mediaBadge: 'Verifizierter Vergleich',
    mediaDescription:
      'Ein ruhiger, hochwertiger Video-Hintergrund verbessert die Lesbarkeit und hält den Fokus auf Vertrauen und fundierten Behandlungsentscheidungen.',
    mediaTitle: 'Vertrauensvoller Klinikvergleich beginnt mit klaren Informationen.',
    metaDescription:
      'Strukturierte Klinikprofile und transparente Qualitäts-Signale - damit du die passende Klinik mit mehr Vertrauen findest.',
    metaTitle: 'findmydoc | Eine Vergleichsplattform für Schönheitskliniken.',
    narrative:
      'Ich glaube, medizinische Entscheidungen dürfen nicht vom Bauchgefühl oder von Informationschaos abhängen. Deshalb machen wir Optionen verständlich und vergleichbar – mit klaren Kriterien, echten Fakten und Orientierung. findmydoc hilft Patient:innen aus der DACH-Region, passende Kliniken im Ausland mit mehr Sicherheit zu finden.\n\nIch glaube, Vertrauen entsteht, wenn Erwartungen realistisch sind und nächste Schritte klar werden. Deshalb strukturieren wir Informationen, erklären Unterschiede und geben dir eine klare Vergleichslogik an die Hand. findmydoc macht es einfacher, Kliniken und Behandlungen gezielt zu vergleichen und vorbereitet anzufragen.',
    primaryCtaLabel: 'Kontakt aufnehmen',
    searchIntent: 'Vergleichsorientiert mit vertrauensfokussierter Launch-Intention',
    signalContactBody:
      'Wenn es passt, kannst du gezielt anfragen und die nächsten Schritte anhand deiner Bedürfnisse klären.',
    signalContactTitle: 'Direkter nächster Schritt',
    signalTrustBody:
      'Transparente Indikatoren helfen dir, Optionen besser einzuordnen und Erwartungen realistischer zu setzen.',
    signalTrustTitle: 'Mehr Vertrauen durch Qualitäts-Signale',
    signalVerifyBody:
      'Behandlungen, Spezialisierungen und relevante Profilinfos übersichtlich und transparent nebeneinander sehen, bevor du Kontakt aufnimmst.',
    signalVerifyTitle: 'Kliniken strukturiert vergleichen',
    statusLabel: 'Bald verfügbar',
    subheadlineText:
      'Strukturierte Klinikprofile und transparente Qualitäts-Signale - damit du die passende Klinik mit mehr Vertrauen findest.',
    title: 'Eine Vergleichsplattform für Schönheitskliniken.',
    whatYouGetEyebrow: 'DAS ERWARTET DICH',
    whySectionEyebrow: 'Founders vision',
    whySectionHeading: 'Patient:innen DACH',
  },
  tr: {
    contactConsent:
      'Bu formu göndererek findmydoc’un talebinizle ilgili sizinle iletişime geçebileceğini kabul etmiş olursunuz.',
    contactDescription:
      'Bu form üzerinden bize doğrudan ulaşabilirsiniz. Kısa bir başlık, mesajınız ve size dönüş yapabilmemiz için e-posta adresinizi ekleyin.',
    contactEyebrow: 'İletişim',
    contactFormLabels: {
      emailPlaceholder: 'E-posta',
      emailRequiredMessage: 'E-posta zorunludur.',
      genericErrorMessage: 'Talebiniz şu anda gönderilemedi.',
      messagePlaceholder: 'Mesaj',
      messageRequiredMessage: 'Mesaj zorunludur.',
      namePlaceholder: 'Ad Soyad',
      nameRequiredMessage: 'Ad Soyad zorunludur.',
      submittingLabel: 'Gönderiliyor...',
      successMessage: 'Talebiniz başarıyla gönderildi.',
    },
    contactTitle: 'Bize ulaşın',
    description:
      'findmydoc, hasta deneyimlerini ve kalite göstergelerini tek bir yerde toplar - şeffaf, karşılaştırılabilir, anlaşılır.',
    eyebrow: 'Türkiye’deki estetik klinikler için',
    footerImprintLabel: 'Yasal Bildirim',
    footerPrivacyLabel: 'Gizlilik Politikası',
    internalLinkClinicQualitySignals: 'Klinik kalite göstergeleri',
    internalLinkCompareClinics: 'Klinikleri tedaviye göre karşılaştırın',
    internalLinkTreatmentGuides: 'Tedavi rehberleri',
    mediaBadge: 'Doğrulanmış karşılaştırma',
    mediaDescription:
      'Sakin ve yüksek kaliteli video arka planı, okunabilirliği artırırken odağı güvene ve bilinçli karar vermeye taşır.',
    mediaTitle: 'Güven veren bir klinik karşılaştırması, net bilgilerle başlar.',
    metaDescription:
      'Yapılandırılmış klinik profilleri ve net kalite göstergeleri - böylece klinikler görünür olur ve kendilerine uygun başvurular alır.',
    metaTitle: 'findmydoc | Avrupa’dan daha nitelikli başvurular.',
    narrative:
      'İyi kliniklerin daha yüksek sesle konuşmak zorunda kalmaması, aksine daha iyi anlaşılması gerektiğine inanıyorum. Bu yüzden kliniklere net bir sahne sunuyoruz: standartlaştırılmış profiller, anlaşılır bilgiler ve güven veren bir sunum. findmydoc, Türkiye’deki kliniklerin DACH bölgesinden kendilerine uygun hastalar tarafından bulunmasına yardımcı olur.\n\nEn iyi eşleşmenin, iki tarafın da en baştan aynı şeyi kastettiği eşleşme olduğuna inanıyorum. Bu yüzden beklenti yönetimini net bilgiler ve daha net bir ilk iletişim ile iyileştiriyoruz. findmydoc, kliniklere daha uygun başvurular ve hastalara doğru seçeneğe giden daha verimli bir yol sunar.',
    primaryCtaLabel: 'İletişime geçin',
    searchIntent: 'Güven odaklı karşılaştırmalı arama',
    signalContactBody: 'Daha uygun hastalar, daha hedefli sorular ve randevuya kadar daha verimli bir süreç.',
    signalContactTitle: 'Daha nitelikli başvurular',
    signalTrustBody: 'Standartlaştırılmış bilgiler belirsizlikleri azaltır ve ilk görüşmelerin kalitesini artırır.',
    signalTrustTitle: 'Dönüşüm sağlayan profil',
    signalVerifyBody: 'Hastaların aktif olarak karşılaştırma yaptığı yerde, güven veren bir profille görünür olun.',
    signalVerifyTitle: 'Daha fazla görünürlük',
    statusLabel: 'Yakında',
    subheadlineText:
      'Yapılandırılmış klinik profilleri ve net kalite göstergeleri - böylece klinikler görünür olur ve kendilerine uygun başvurular alır.',
    title: 'Avrupa’dan daha nitelikli başvurular.',
    whatYouGetEyebrow: 'SİZİ NELER BEKLİYOR',
    whySectionEyebrow: 'Kurucu vizyonu',
    whySectionHeading: 'Türkiye’deki klinikler',
  },
}

const buildTemporaryLandingPageContent = (locale: TemporaryLandingLocale): HoldingPageConceptProps => {
  const copy = copyByLocale[locale]

  return {
    backgroundImage: '',
    bestFor: '',
    contactConsentFull: copy.contactConsent,
    contactEyebrow: copy.contactEyebrow,
    contactFormLabels: copy.contactFormLabels,
    contactFormSlug: 'holding-contact',
    contactDescription: copy.contactDescription,
    contactMode: 'full',
    contactTitle: copy.contactTitle,
    description: copy.description,
    eyebrow: copy.eyebrow,
    footerLinks: [
      { href: '/privacy-policy', label: copy.footerPrivacyLabel, appearance: 'inline' },
      { href: '/imprint', label: copy.footerImprintLabel, appearance: 'inline' },
    ],
    heroVideo: {
      ctaHref: '#contact',
      crossfadeMs: 700,
      playbackRate: 0.78,
      posterSrc: '/images/landing/home-hero-telemedicine.jpg',
      videoBlurPx: 2.2,
      videoSrc: '/stories/immersive-hero-loop.mp4',
      requiredLabel: 'Background video currently unavailable',
      subheadlineText: copy.subheadlineText,
      useReducedMotionFallback: true,
      withCrossfade: true,
    },
    layoutMode: 'video',
    mediaNote: {
      badge: copy.mediaBadge,
      description: copy.mediaDescription,
      title: copy.mediaTitle,
    },
    narrative: copy.narrative,
    overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
    primaryCtaLabel: copy.primaryCtaLabel,
    searchSnapshot: {
      internalLinks: [
        { href: '/listing-comparison', label: copy.internalLinkCompareClinics, appearance: 'inline' },
        { href: '/posts', label: copy.internalLinkClinicQualitySignals, appearance: 'inline' },
        { href: '/partners/clinics', label: copy.internalLinkTreatmentGuides, appearance: 'inline' },
      ],
      metaDescription: copy.metaDescription,
      metaTitle: copy.metaTitle,
      primaryKeyword: 'compare clinics abroad',
      searchIntent: copy.searchIntent,
    },
    signals: [
      {
        title: copy.signalVerifyTitle,
        body: copy.signalVerifyBody,
        icon: UserRoundSearch,
      },
      {
        title: copy.signalTrustTitle,
        body: copy.signalTrustBody,
        icon: ShieldCheck,
      },
      {
        title: copy.signalContactTitle,
        body: copy.signalContactBody,
        icon: ArrowLeftRight,
      },
    ],
    specialties: ['Dental', 'Eye Care', 'Hair Restoration', 'Plastic Surgery'],
    statusLabel: copy.statusLabel,
    supportingNote: '',
    themeName: 'Temporary public landing',
    title: copy.title,
    visualVariant: 'videoImmersiveHero',
    whatYouGetEyebrow: copy.whatYouGetEyebrow,
    whySectionEyebrow: copy.whySectionEyebrow,
    whySectionHeading: copy.whySectionHeading,
  }
}

export const temporaryLandingPageContentByLocale: Record<TemporaryLandingLocale, HoldingPageConceptProps> = {
  en: buildTemporaryLandingPageContent('en'),
  de: buildTemporaryLandingPageContent('de'),
  tr: buildTemporaryLandingPageContent('tr'),
}

export const getTemporaryLandingPageContent = (locale: TemporaryLandingLocale): HoldingPageConceptProps =>
  temporaryLandingPageContentByLocale[locale] ?? temporaryLandingPageContentByLocale[TEMPORARY_LANDING_DEFAULT_LOCALE]
