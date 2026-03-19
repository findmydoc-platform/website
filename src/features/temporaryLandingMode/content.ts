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
      'findmydoc brings profiles, reviews, and verification status together in one place so you can decide with confidence.',
    eyebrow: 'Evaluate clinics abroad with confidence.',
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
      'Compare clinics abroad with trusted quality information, transparent profiles, and a clear next step before treatment.',
    metaTitle: 'findmydoc | Compare Clinics Abroad',
    narrative:
      'Findmydoc is designed for people who want to compare clinics abroad with more confidence before making a medical travel decision. Instead of switching between fragmented websites, patients can review structured clinic profiles, treatment options, and transparent quality signals in one comparison flow.\n\nThe goal is to make clinic research easier to understand, easier to verify, and easier to act on. By combining verification status, patient reviews, listed accreditations, and specialty fit, this layout supports clearer expectations and more informed next steps. The section also keeps legal transparency visible through direct links to Privacy Policy and Imprint, while still preserving a calm, focused reading experience below the hero.',
    primaryCtaLabel: 'Get in touch',
    searchIntent: 'Comparative with trust-focused launch intent',
    signalContactBody:
      'Contact clinics directly without intermediaries and discuss next steps based on your treatment needs.',
    signalContactTitle: 'Direct clinic contact',
    signalTrustBody:
      'Use ratings, reviews, verification status, and accreditations to evaluate options with more confidence.',
    signalTrustTitle: 'Trust through quality signals',
    signalVerifyBody:
      'Review treatments, specialties, and profile information side by side before contacting a clinic.',
    signalVerifyTitle: 'Compare verified clinics',
    statusLabel: 'Coming Soon',
    subheadlineText: 'Discover verified clinics, compare the details, and choose the option that fits you best.',
    title: 'Compare verified clinics and compare the details.',
    whatYouGetEyebrow: 'What you get',
    whySectionEyebrow: 'Why findmydoc',
    whySectionHeading: 'Compare clinics abroad with verified quality signals and trusted guidance.',
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
      'findmydoc bündelt Profile, Bewertungen und Verifizierungsstatus an einem Ort, damit du sicher entscheiden kannst.',
    eyebrow: 'Kliniken im Ausland sicher bewerten.',
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
      'Vergleiche Kliniken im Ausland mit vertrauenswürdigen Qualitätsinformationen, transparenten Profilen und einem klaren nächsten Schritt.',
    metaTitle: 'findmydoc | Kliniken im Ausland vergleichen',
    narrative:
      'findmydoc ist für Menschen gedacht, die Kliniken im Ausland mit mehr Sicherheit vergleichen möchten, bevor sie eine Entscheidung für eine medizinische Reise treffen. Statt zwischen fragmentierten Webseiten zu wechseln, können Patientinnen und Patienten strukturierte Klinikprofile, Behandlungsoptionen und transparente Qualitätsmerkmale in einem einzigen Vergleichsablauf prüfen.\n\nZiel ist es, die Klinikrecherche verständlicher, besser überprüfbar und einfacher umsetzbar zu machen. Durch die Kombination aus Verifizierungsstatus, Patientenbewertungen, aufgeführten Akkreditierungen und fachlicher Passung unterstützt dieses Layout klare Erwartungen und fundierte nächste Schritte. Gleichzeitig bleiben rechtliche Informationen über direkte Links zu Datenschutz und Impressum sichtbar, während unterhalb des Hero-Bereichs ein ruhiges, fokussiertes Leseerlebnis erhalten bleibt.',
    primaryCtaLabel: 'Kontakt aufnehmen',
    searchIntent: 'Vergleichsorientiert mit vertrauensfokussierter Launch-Intention',
    signalContactBody:
      'Kontaktiere Kliniken direkt ohne Vermittler und kläre nächste Schritte passend zu deinem Behandlungsbedarf.',
    signalContactTitle: 'Direkter Kontakt zur Klinik',
    signalTrustBody:
      'Nutze Bewertungen, Rezensionen, Verifizierungsstatus und Akkreditierungen, um Optionen mit mehr Sicherheit zu bewerten.',
    signalTrustTitle: 'Vertrauen durch Qualitätsmerkmale',
    signalVerifyBody:
      'Vergleiche Behandlungen, Schwerpunkte und Profilinformationen nebeneinander, bevor du eine Klinik kontaktierst.',
    signalVerifyTitle: 'Verifizierte Kliniken vergleichen',
    statusLabel: 'Bald verfügbar',
    subheadlineText:
      'Entdecke verifizierte Kliniken, vergleiche die Details und wähle die Lösung, die am besten zu dir passt.',
    title: 'Verifizierte Kliniken entdecken und Details vergleichen.',
    whatYouGetEyebrow: 'Das bekommst du',
    whySectionEyebrow: 'Warum findmydoc',
    whySectionHeading:
      'Vergleiche Kliniken im Ausland mit verifizierten Qualitätsmerkmalen und verlässlicher Orientierung.',
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
    description: 'findmydoc, karar vermeniz için gereken bilgileri tek bir yerde toplar.',
    eyebrow: 'Yurt dışındaki klinikleri güvenle karşılaştırın.',
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
      'Yurt dışındaki klinikleri güvenilir bilgiler, şeffaf profiller ve net bir sonraki adımla karşılaştırın.',
    metaTitle: 'findmydoc | Yurt Dışında Klinik Karşılaştırması',
    narrative:
      'findmydoc, tıbbi seyahat kararı vermeden önce yurt dışındaki klinikleri daha güvenle karşılaştırmak isteyen kişiler için tasarlanmıştır. Parçalı web siteleri arasında dolaşmak yerine hastalar, yapılandırılmış klinik profillerini, tedavi seçeneklerini ve şeffaf bilgileri tek bir akışta inceleyebilir.\n\nAmaç, klinik araştırmasını daha anlaşılır, daha güvenilir ve bir sonraki adıma daha hazır hale getirmektir. Doğrulanmış bilgiler, hasta değerlendirmeleri, listelenen akreditasyonlar ve uzmanlık uyumu bir araya geldiğinde beklentiler daha net olur ve sonraki adım kolaylaşır. Aynı zamanda, Gizlilik Politikası ve Yasal Bildirim bağlantıları görünür kalırken, üst bölümün altında sakin ve odaklı bir okuma deneyimi korunur.',
    primaryCtaLabel: 'İletişime geçin',
    searchIntent: 'Güven odaklı karşılaştırmalı arama',
    signalContactBody:
      'Aracı olmadan kliniklerle doğrudan iletişime geçin ve tedavi sürecinizde sonraki adımları netleştirin.',
    signalContactTitle: 'Klinikle doğrudan iletişim',
    signalTrustBody:
      'Puanlar, yorumlar, doğrulanmış bilgiler ve akreditasyonlar sayesinde seçenekleri daha güvenle değerlendirin.',
    signalTrustTitle: 'Kalite göstergeleriyle güven',
    signalVerifyBody:
      'Bir klinikle iletişime geçmeden önce tedavi seçeneklerini, uzmanlık alanlarını ve profil bilgilerini karşılaştırın.',
    signalVerifyTitle: 'Doğrulanmış klinikleri karşılaştırın',
    statusLabel: 'Yakında',
    subheadlineText: 'Doğrulanmış klinikleri keşfedin, detayları karşılaştırın ve size en uygun seçimi güvenle yapın.',
    title: 'Doğrulanmış klinikleri keşfedin, detayları karşılaştırın.',
    whatYouGetEyebrow: 'Neler sunuyoruz',
    whySectionEyebrow: 'Neden findmydoc',
    whySectionHeading: 'Yurt dışındaki klinikleri doğrulanmış bilgiler ve güvenilir rehberlikle karşılaştırın.',
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
