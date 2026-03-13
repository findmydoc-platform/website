import type { UiLinkProps } from '@/components/molecules/Link'
import type { HoldingPageConceptProps } from '@/components/templates/HoldingPageConcept'
import {
  Activity,
  ArrowLeftRight,
  Building2,
  CircleGauge,
  Eye,
  FlaskConical,
  Globe2,
  HeartHandshake,
  MapPinned,
  Plane,
  ScanSearch,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
  UserRoundSearch,
} from 'lucide-react'

import clinicReception from '@/endpoints/seed/assets/demo/unsplash/clinic-reception.jpg'
import dentalClinic from '@/endpoints/seed/assets/demo/unsplash/dental-clinic.jpg'
import rehabPhysio from '@/endpoints/seed/assets/demo/unsplash/rehab-physio.jpg'
import skincareSerum from '@/endpoints/seed/assets/demo/unsplash/skincare-serum.jpg'
import telemedicineHomeOffice from '@/endpoints/seed/assets/demo/unsplash/telemedicine-home-office.jpg'
import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'
import contentClinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import featureBackground from '@/stories/assets/feature-background.jpg'
import medicalHero from '@/stories/assets/medical-hero.jpg'
import postHeroExamRoom from '@/stories/assets/post-hero-exam-room.jpg'

type HoldingPageConceptId =
  | 'trustedArrival'
  | 'compareBeforeTravel'
  | 'dentalConfidence'
  | 'visionPrecision'
  | 'hairRestorationJourney'
  | 'skinScienceTrust'
  | 'surgicalClarity'
  | 'medicalTravelRoute'
  | 'standardsYouCanFeel'
  | 'onePlatformManyPaths'
  | 'videoConsultationCanvas'
  | 'videoProcedureLight'
  | 'videoArrivalWindow'
  | 'videoImmersiveHero'

const footerLinks: UiLinkProps[] = [
  { href: '#contact', label: 'Contact', appearance: 'inline' },
  { href: '/privacy-policy', label: 'Privacy Policy', appearance: 'inline' },
  { href: '/imprint', label: 'Imprint', appearance: 'inline' },
]

const immersiveHeroFooterLinks: UiLinkProps[] = [
  ...footerLinks,
  {
    href: 'https://www.istockphoto.com/de/video/medizinisches-dokument-junge-%C3%A4rztin-erkl%C3%A4rt-dokument-mit-analysen-auf-dem-tisch-und-gm2175001398-594611883',
    label: 'Video Reference',
    appearance: 'inline',
    newTab: true,
  },
]

const platformInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare clinics', appearance: 'inline' },
  { href: '/posts', label: 'Treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'For clinics', appearance: 'inline' },
]

const dentalInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare dental clinics', appearance: 'inline' },
  { href: '/posts', label: 'Dental treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'Clinic partnerships', appearance: 'inline' },
]

const surgicalInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare surgery clinics', appearance: 'inline' },
  { href: '/posts', label: 'Decision guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'Partner with findmydoc', appearance: 'inline' },
]

const eyeInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare eye clinics', appearance: 'inline' },
  { href: '/posts', label: 'Vision treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'For specialist clinics', appearance: 'inline' },
]

const hairInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare hair clinics', appearance: 'inline' },
  { href: '/posts', label: 'Hair restoration guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'Grow as a clinic partner', appearance: 'inline' },
]

const skinInternalLinks: UiLinkProps[] = [
  { href: '/listing-comparison', label: 'Compare dermatology clinics', appearance: 'inline' },
  { href: '/posts', label: 'Skin treatment guides', appearance: 'inline' },
  { href: '/partners/clinics', label: 'For aesthetic clinics', appearance: 'inline' },
]

const sharedSpecialties = ['Dental', 'Eye Care', 'Hair Restoration', 'Dermatology', 'Plastic Surgery']

export const conceptOrder: HoldingPageConceptId[] = [
  'trustedArrival',
  'compareBeforeTravel',
  'dentalConfidence',
  'visionPrecision',
  'hairRestorationJourney',
  'skinScienceTrust',
  'surgicalClarity',
  'medicalTravelRoute',
  'standardsYouCanFeel',
  'onePlatformManyPaths',
  'videoConsultationCanvas',
  'videoProcedureLight',
  'videoArrivalWindow',
  'videoImmersiveHero',
]

export const holdingPageConcepts: Record<HoldingPageConceptId, HoldingPageConceptProps> = {
  trustedArrival: {
    backgroundImage: clinicReception,
    backgroundImageClassName: 'object-center',
    bestFor: 'A broad launch direction that should feel welcoming, premium, and established on first contact.',
    contactDescription: 'Invite early questions from patients and clinics without sounding promotional or pushy.',
    contactTitle: 'Open the first conversation',
    description:
      'A reception-led findmydoc direction for people who want to compare clinics abroad with clearer treatment information, stronger trust signals, and a calmer next step.',
    eyebrow: 'Findmydoc clinic comparison for treatment abroad',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Warm lobby footage, soft arrival movement, and quiet hospitality cues keep the page bright while still signaling trust from the first second.',
      title: 'Reception imagery works best when it feels airy, human, and well-prepared.',
    },
    narrative:
      'This direction puts trust before excitement. It says something serious and well-considered is arriving, not just another medical landing page.',
    overlayClassName: 'from-white/95 via-sky-50/76 to-white/88',
    primaryCtaLabel: 'Request launch updates',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Findmydoc helps patients compare clinics abroad with clearer treatment information, stronger trust signals, and a more confident next step.',
      metaTitle: 'Compare Clinics Abroad with More Trust | Findmydoc',
      primaryKeyword: 'compare clinics abroad',
      searchIntent: 'Comparative with clear action intent',
    },
    signals: [
      {
        title: 'Compare with context',
        body: 'The platform feels like a place to evaluate options, not rush into them.',
        icon: ArrowLeftRight,
      },
      {
        title: 'Trust from the first second',
        body: 'Reception and arrival imagery make the brand feel prepared, human, and attentive.',
        icon: HeartHandshake,
      },
      {
        title: 'Broad enough for the full spectrum',
        body: 'It supports dental, hair, eye, skin, and surgery without leaning too hard into one category.',
        icon: Building2,
      },
    ],
    specialties: sharedSpecialties,
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: bright clinic reception, soft daylight, clean architecture, no luxury cliches.',
    themeName: 'Warm reception and broad trust',
    title: 'Compare clinics abroad with more trust and more clarity.',
    visualVariant: 'openLobby',
  },
  compareBeforeTravel: {
    backgroundImage: telemedicineHomeOffice,
    backgroundImageClassName: 'object-center',
    bestFor:
      'A launch story centered on planning, comparison, and better decisions before international travel begins.',
    contactDescription:
      'This concept works best when the CTA feels like a smart next step rather than a sales handoff.',
    contactTitle: 'Start before the journey',
    description:
      'A consultation-first direction that frames findmydoc as a clinic comparison platform for treatment abroad and more informed medical tourism planning.',
    eyebrow: 'Medical tourism comparison before the journey starts',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Daylight desk footage, note-taking, and laptop movement make the page feel useful and prepared instead of dark or cinematic.',
      title: 'Planning imagery should look structured, bright, and immediately understandable.',
    },
    narrative:
      'The brand feels useful and intelligent here. It focuses on preparation, transparency, and the confidence that comes from doing the homework early.',
    overlayClassName: 'from-white/95 via-cyan-50/78 to-white/88',
    primaryCtaLabel: 'Join the waiting list',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Compare treatment options abroad before you travel. Findmydoc brings clinic comparison, trust signals, and medical tourism planning together.',
      metaTitle: 'Compare Treatment Options Abroad | Findmydoc',
      primaryKeyword: 'treatment abroad comparison',
      searchIntent: 'Informational to comparative',
    },
    signals: [
      {
        title: 'Compare before commitment',
        body: 'Review treatment options, clinic profiles, and key differences before you decide.',
        icon: UserRoundSearch,
      },
      {
        title: 'International by design',
        body: 'Built for cross-border decisions with transparent clinic data and travel-relevant context.',
        icon: Globe2,
      },
      {
        title: 'Trust through verified quality',
        body: 'Ratings, verified profiles, and listed accreditations make trust visible at a glance.',
        icon: ShieldCheck,
      },
    ],
    specialties: ['Dental', 'Eye Care', 'Hair Restoration', 'Plastic Surgery'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: telemedicine desk, daylight planning, notes, quiet confidence.',
    themeName: 'Consultation and travel planning',
    title: 'Compare treatment options abroad before the journey begins.',
    visualVariant: 'planningBoard',
  },
  dentalConfidence: {
    backgroundImage: dentalClinic,
    backgroundImageClassName: 'object-center',
    bestFor: 'A strong category-led launch direction when dental treatments are expected to be a visible entry point.',
    contactDescription:
      'Use this when the contact invitation should feel practical and conversion-ready, not editorial.',
    contactTitle: 'Start with a clearer shortlist',
    description:
      'A dental-first direction that supports search intent around comparing dental clinics abroad while keeping the wider findmydoc platform story intact.',
    eyebrow: 'Dental clinic comparison abroad with visible trust',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Bright treatment-room imagery, hands at work, and visible technology can stay premium without making the overall page feel dark.',
      title: 'Dental visuals land best when cleanliness and precision feel immediate and light.',
    },
    narrative:
      'Dental imagery gives the page immediate clarity while still leaving room for the rest of the findmydoc treatment spectrum.',
    overlayClassName: 'from-white/94 via-cyan-50/82 to-emerald-50/74',
    primaryCtaLabel: 'Get notified at launch',
    searchSnapshot: {
      internalLinks: dentalInternalLinks,
      metaDescription:
        'Compare dental clinics abroad with clearer quality signals, structured information, and a more confident path to treatment.',
      metaTitle: 'Compare Dental Clinics Abroad | Findmydoc',
      primaryKeyword: 'compare dental clinics abroad',
      searchIntent: 'Comparative with treatment research intent',
    },
    signals: [
      {
        title: 'Clear visual quality',
        body: 'The environment feels precise and modern without becoming sterile.',
        icon: Smile,
      },
      {
        title: 'Easy to understand',
        body: 'Dental is one of the fastest ways to communicate comparison and decision support.',
        icon: ArrowLeftRight,
      },
      {
        title: 'Works beyond one category',
        body: 'The structure can still expand naturally into eye care, skin, hair, and surgery.',
        icon: Stethoscope,
      },
    ],
    specialties: ['Dental', 'Cosmetic Dentistry', 'Orthodontics', 'Implants'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: modern dental room, visible cleanliness, daylight clinical quality.',
    themeName: 'Dental trust and visible precision',
    title: 'Compare dental clinics abroad with more visible trust.',
    visualVariant: 'dentalBanner',
  },
  visionPrecision: {
    backgroundImage: medicalHero,
    backgroundImageClassName: 'object-center',
    bestFor: 'A more elevated, precision-led direction suited to eye care, careful procedures, and calm confidence.',
    contactDescription: 'This CTA should feel reassuring and exact, as if the next step is guided and well-structured.',
    contactTitle: 'Ask what good comparison looks like',
    description:
      'This direction leans into accuracy and restraint. It helps findmydoc speak to clinic comparison for eye care and vision treatment without hype.',
    eyebrow: 'Eye care comparison with precision and trust',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Daylight facade or technology-led footage keeps the atmosphere high-trust while still fitting a mostly white page language.',
      title: 'Precision can look clean and premium without becoming cold or dark.',
    },
    narrative:
      'The visual story favors control and quiet confidence. It is especially strong for eye care, technology-led treatment, and credible premium positioning.',
    overlayClassName: 'from-white/95 via-slate-50/82 to-sky-50/76',
    primaryCtaLabel: 'See the launch first',
    searchSnapshot: {
      internalLinks: eyeInternalLinks,
      metaDescription:
        'Compare eye care and vision clinics with clearer trust signals, structured information, and a more careful decision path.',
      metaTitle: 'Compare Eye Care Clinics with Trust | Findmydoc',
      primaryKeyword: 'compare eye care clinics',
      searchIntent: 'Comparative with high-trust research intent',
    },
    signals: [
      {
        title: 'Calm, not flashy',
        body: 'The page feels controlled and deliberate, which supports trust-heavy categories.',
        icon: Eye,
      },
      {
        title: 'Technology with restraint',
        body: 'A precise medical tone makes the platform feel rigorous rather than promotional.',
        icon: ScanSearch,
      },
      {
        title: 'Premium without vanity',
        body: 'The style feels high-end while staying clinically believable.',
        icon: CircleGauge,
      },
    ],
    specialties: ['Eye Care', 'Laser Vision Correction', 'Lens Surgery', 'Cataract Surgery'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: daylight clinic exterior, careful detail, thoughtful composition.',
    themeName: 'Controlled precision and clinical calm',
    title: 'Compare eye care clinics with clearer precision and trust.',
    visualVariant: 'precisionLens',
  },
  hairRestorationJourney: {
    backgroundImage: clinicConsultation,
    backgroundImageClassName: 'object-center',
    bestFor: 'A people-first direction for categories where identity, confidence, and long decision cycles matter.',
    contactDescription: 'Keep the CTA empathetic and grounded. The page should feel helpful, never cosmetic-first.',
    contactTitle: 'Start with a better overview',
    description:
      'A more human consultation scene helps findmydoc speak to hair restoration clinic comparison with empathy, trust, and structured planning.',
    eyebrow: 'Hair restoration clinic comparison with empathy',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Human consultation footage gives the concept warmth and trust quickly, especially when the rest of the page stays bright and spacious.',
      title: 'Identity-linked care needs eye contact, conversation, and daylight more than drama.',
    },
    narrative:
      'This direction is especially useful for hair restoration and other identity-linked treatments where empathy matters as much as structure.',
    overlayClassName: 'from-white/95 via-emerald-50/76 to-white/88',
    primaryCtaLabel: 'Ask for early access',
    searchSnapshot: {
      internalLinks: hairInternalLinks,
      metaDescription:
        'Compare hair restoration clinics with clearer trust signals, stronger treatment context, and a calmer path to the next step.',
      metaTitle: 'Compare Hair Restoration Clinics | Findmydoc',
      primaryKeyword: 'compare hair restoration clinics',
      searchIntent: 'Comparative with strong decision support',
    },
    signals: [
      {
        title: 'Human without becoming soft',
        body: 'The page feels personal while staying informative and platform-led.',
        icon: HeartHandshake,
      },
      {
        title: 'Good for longer decisions',
        body: 'The tone supports treatments that involve reflection, planning, and emotional nuance.',
        icon: Activity,
      },
      {
        title: 'Comparison still leads',
        body: 'Empathy supports the story, but trust and evaluation remain the core message.',
        icon: ArrowLeftRight,
      },
    ],
    specialties: ['Hair Restoration', 'Scalp Hair Transplant', 'Facial Hair Transplant', 'Hair Loss Therapy'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: consultation, person-to-person guidance, measured reassurance.',
    themeName: 'Human guidance and identity-linked care',
    title: 'Compare hair restoration clinics with more confidence.',
    visualVariant: 'conversationRibbon',
  },
  skinScienceTrust: {
    backgroundImage: skincareSerum,
    backgroundImageClassName: 'object-center',
    bestFor: 'A polished but still credible direction for dermatology, injectables, and science-led aesthetic care.',
    contactDescription:
      'The contact moment should feel like the next rational step after curiosity, not an impulse action.',
    contactTitle: 'See what the first version could become',
    description:
      'This concept connects visible aesthetics with scientific discipline, helping findmydoc speak to dermatology and injectables comparison without drifting into beauty-brand language.',
    eyebrow: 'Dermatology and injectables comparison with trust',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Close-up product or treatment texture footage can still work on a white page if the surrounding surfaces stay clean, editorial, and medically grounded.',
      title: 'Scientific aesthetics should feel controlled and luminous, not glossy or overly luxurious.',
    },
    narrative:
      'It keeps the page elegant while remaining grounded in care, standards, and medical credibility. That balance is the main value here.',
    overlayClassName: 'from-white/95 via-teal-50/78 to-white/88',
    primaryCtaLabel: 'Request launch access',
    searchSnapshot: {
      internalLinks: skinInternalLinks,
      metaDescription:
        'Compare dermatology and injectables clinics with clearer standards, stronger trust, and a more informed treatment decision.',
      metaTitle: 'Compare Dermatology Clinics with Trust | Findmydoc',
      primaryKeyword: 'compare dermatology clinics',
      searchIntent: 'Comparative with category research intent',
    },
    signals: [
      {
        title: 'Modern and clean',
        body: 'The direction feels current and premium without becoming generic skincare branding.',
        icon: FlaskConical,
      },
      {
        title: 'Trust for lighter interventions',
        body: 'It supports non-surgical treatments where credibility still matters deeply.',
        icon: ShieldCheck,
      },
      {
        title: 'Good bridge to the wider platform',
        body: 'This concept can extend into more medical or more aesthetic categories without strain.',
        icon: Sparkles,
      },
    ],
    specialties: ['Dermatology', 'Laser Dermatology', 'Injectables', 'Skin Conditions'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: soft laboratory textures, bright surfaces, quiet scientific confidence.',
    themeName: 'Scientific aesthetics and modern care',
    title: 'Compare dermatology and injectables clinics with more trust.',
    visualVariant: 'labGallery',
  },
  surgicalClarity: {
    backgroundImage: contentClinicInterior,
    backgroundImageClassName: 'object-center',
    bestFor:
      'A mature direction for plastic surgery that feels serious, discreet, and decision-oriented rather than glamorous.',
    contactDescription:
      'The CTA should sound measured and private, closer to an informed inquiry than a conversion push.',
    contactTitle: 'Keep the next step discreet',
    description:
      'This concept frames plastic surgery clinic comparison as a serious decision that deserves structure, context, and trust rather than exaggerated transformation imagery.',
    eyebrow: 'Plastic surgery clinic comparison without hype',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Interior footage can stay restrained and premium on a light page when the surrounding layout does the calming and the content avoids vanity cues.',
      title: 'Discretion matters more than drama for surgery-related imagery.',
    },
    narrative:
      'This is the strongest route when plastic surgery must be visible, but you do not want the brand to collapse into vanity cues or luxury tropes.',
    overlayClassName: 'from-white/95 via-stone-50/80 to-white/88',
    primaryCtaLabel: 'Ask to be informed first',
    searchSnapshot: {
      internalLinks: surgicalInternalLinks,
      metaDescription:
        'Compare plastic surgery clinics with clearer trust signals, more structure, and a calmer path to an informed decision.',
      metaTitle: 'Compare Plastic Surgery Clinics | Findmydoc',
      primaryKeyword: 'compare plastic surgery clinics',
      searchIntent: 'Comparative with high-conversion intent',
    },
    signals: [
      {
        title: 'Discreet and grown-up',
        body: 'The concept respects the weight of surgical decisions without dramatizing them.',
        icon: ShieldCheck,
      },
      {
        title: 'Comparison over aspiration',
        body: 'It avoids beauty-brand language and keeps the platform in a trusted guide role.',
        icon: ArrowLeftRight,
      },
      {
        title: 'Still broad enough to fit findmydoc',
        body: 'The page can hold surgery without losing the multi-category platform identity.',
        icon: Building2,
      },
    ],
    specialties: ['Plastic Surgery', 'Facial Surgery', 'Breast Surgery', 'Body Contouring'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: restrained consultation interiors, pale materials, discreet premium tone.',
    themeName: 'Discretion, maturity, and surgical trust',
    title: 'Compare plastic surgery clinics with a clearer, calmer frame.',
    visualVariant: 'privateSuite',
  },
  medicalTravelRoute: {
    backgroundImage: clinicHospitalExterior,
    backgroundImageClassName: 'object-center',
    bestFor: 'A launch direction that puts international travel and destination confidence at the center of the story.',
    contactDescription:
      'This CTA can invite both early patient demand and clinic-side interest in the platform journey.',
    contactTitle: 'Plan what comes next',
    description:
      'A destination-led approach helps findmydoc speak to medical tourism, clinic comparison, and treatment abroad planning in one coherent page story.',
    eyebrow: 'Medical tourism and clinic comparison in one path',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Exterior daylight footage with leaves, building approach, and gentle movement makes medical travel visible without turning the brand into a travel site.',
      title: 'Arrival works best when place is visible but the medical context stays intact.',
    },
    narrative:
      'This direction gives medical tourism a visible place in the brand story without making the site feel like a travel operator.',
    overlayClassName: 'from-white/95 via-sky-50/76 to-emerald-50/72',
    primaryCtaLabel: 'Follow the launch journey',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Findmydoc connects medical tourism planning with clinic comparison, trust signals, and clearer next steps for treatment abroad.',
      metaTitle: 'Medical Tourism Meets Clinic Comparison | Findmydoc',
      primaryKeyword: 'medical tourism clinic comparison',
      searchIntent: 'Informational to comparative',
    },
    signals: [
      {
        title: 'Travel context without travel-branding',
        body: 'The page recognizes cross-border care while staying medical and trustworthy.',
        icon: Plane,
      },
      {
        title: 'Good fit for destination-led messaging',
        body: 'Useful when geography, arrival, and clinic access will be part of the launch story.',
        icon: MapPinned,
      },
      {
        title: 'Still anchored in comparison',
        body: 'The idea is not movement for its own sake, but smarter decision-making across borders.',
        icon: Globe2,
      },
    ],
    specialties: ['Dental', 'Hair Restoration', 'Plastic Surgery', 'Dermatology'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: arrival, daylight exterior, route, confidence in the journey ahead.',
    themeName: 'International movement and treatment planning',
    title: 'Medical tourism needs better clinic comparison and guidance.',
    visualVariant: 'routeTimeline',
  },
  standardsYouCanFeel: {
    backgroundImage: rehabPhysio,
    backgroundImageClassName: 'object-center',
    bestFor: 'A trust-heavy direction when standards, process, and visible rigor should lead the emotional tone.',
    contactDescription:
      'The form prompt should feel like a request for access to a more reliable way of evaluating options.',
    contactTitle: 'Ask for a clearer standard',
    description:
      'This direction focuses on visible professionalism and disciplined care, helping findmydoc speak to verified clinic comparison and trust at first glance.',
    eyebrow: 'Verified clinic comparison with visible standards',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'Bright procedural footage makes standards visible quickly and keeps the entire concept aligned with a white, clinical interface.',
      title: 'Process-led imagery feels strongest when it is clear, bright, and visibly methodical.',
    },
    narrative:
      'The concept says that quality is something people should be able to sense before they ever compare clinics in detail.',
    overlayClassName: 'from-white/95 via-cyan-50/76 to-white/88',
    primaryCtaLabel: 'Request early access',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Compare verified clinics with clearer standards, stronger trust signals, and a more reliable decision path on findmydoc.',
      metaTitle: 'Compare Verified Clinics with Trust | Findmydoc',
      primaryKeyword: 'compare verified clinics',
      searchIntent: 'Comparative with strong trust intent',
    },
    signals: [
      {
        title: 'Process and discipline',
        body: 'It frames the future platform as a structured system rather than a simple directory.',
        icon: CircleGauge,
      },
      {
        title: 'Strong trust signal',
        body: 'Measured clinical action makes the concept feel rigorous from the start.',
        icon: ShieldCheck,
      },
      {
        title: 'Works across specialties',
        body: 'The theme supports the whole medical spectrum without tying itself to one treatment area.',
        icon: Activity,
      },
    ],
    specialties: sharedSpecialties,
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: controlled procedure, measurable standards, bright clinical rigor.',
    themeName: 'Visible standards and clinical rigor',
    title: 'Compare verified clinics with standards you can actually feel.',
    visualVariant: 'standardsGrid',
  },
  onePlatformManyPaths: {
    backgroundImage: postHeroExamRoom,
    backgroundImageClassName: 'object-center',
    bestFor:
      'The best umbrella concept when the launch needs to show breadth across multiple treatment categories from day one.',
    contactDescription:
      'This CTA works when you want to invite broad interest without collapsing into any single specialty story.',
    contactTitle: 'See the platform taking shape',
    description:
      'This direction presents findmydoc as a treatment comparison platform for people researching clinics abroad across multiple specialties.',
    eyebrow: 'Findmydoc as one comparison layer for many paths',
    footerLinks,
    mediaNote: {
      badge: 'Hero mood',
      description:
        'A bright exam-room conversation supports multiple specialties at once and keeps the page unmistakably medical, not beauty-led.',
      title: 'A broad platform story works best with one clean, human, high-trust medical scene.',
    },
    narrative:
      'This is the cleanest expression of the bigger brand idea: many specialties, one calmer way to compare, trust, and move forward.',
    overlayClassName: 'from-white/95 via-slate-50/82 to-cyan-50/74',
    primaryCtaLabel: 'Stay close to the launch',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Compare treatments abroad across one trusted platform. Findmydoc combines clinic comparison, trust, and clearer next steps.',
      metaTitle: 'Compare Treatments Abroad | Findmydoc Platform',
      primaryKeyword: 'compare treatments abroad',
      searchIntent: 'Broad comparative category intent',
    },
    signals: [
      {
        title: 'Broad platform language',
        body: 'It naturally supports dental, eye, hair, skin, and surgery without over-explaining.',
        icon: Building2,
      },
      {
        title: 'Comparison remains the core promise',
        body: 'The page feels like a platform first and a category page second.',
        icon: ArrowLeftRight,
      },
      {
        title: 'Strong default for story testing',
        body: 'This is the easiest concept to test before narrowing into more specialized directions.',
        icon: Globe2,
      },
    ],
    specialties: sharedSpecialties,
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: bright exam room, broad medical relevance, clean system feel.',
    themeName: 'Multi-specialty platform identity',
    title: 'Compare treatments abroad across one trusted platform.',
    visualVariant: 'platformMosaic',
  },
  videoConsultationCanvas: {
    backgroundImage: clinicConsultation,
    backgroundImageClassName: 'object-center',
    bestFor:
      'A motion-led concept where the eventual hero video should show soft doctor-patient interaction without making the page feel heavy.',
    contactDescription:
      'Keep the interaction lightweight. This direction is strongest as a compact waitlist or first-contact capture.',
    contactMode: 'compact',
    contactTitle: 'Get the first launch note',
    description:
      'A bright consultation scene gives findmydoc room for a visible background video while still presenting clinic comparison abroad as calm, structured, and trustworthy.',
    eyebrow: 'Clinic comparison abroad in a bright consultation frame',
    footerLinks,
    layoutMode: 'video',
    mediaNote: {
      badge: 'Video-first concept',
      description:
        'A seated doctor-patient exchange works on mute, carries trust quickly, and still leaves room for headline, keyword, and CTA.',
      title: 'Soft consultation motion keeps the hero alive without losing clarity.',
    },
    narrative:
      'Use slow consultation footage, restrained gestures, and clean daylight. The motion reinforces human guidance without overpowering the comparison message.',
    overlayClassName: 'from-white/96 via-sky-50/74 to-white/88',
    primaryCtaLabel: 'Request early access',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Compare clinics abroad with calmer guidance. Findmydoc combines clinic comparison, trust signals, and a brighter first step.',
      metaTitle: 'Compare Clinics Abroad with Guidance | Findmydoc',
      primaryKeyword: 'compare clinics abroad',
      searchIntent: 'Comparative with strong trust intent',
    },
    signals: [
      {
        title: 'Human motion, not noise',
        body: 'The video adds warmth and trust without making the page feel like an ad.',
        icon: HeartHandshake,
      },
      {
        title: 'Still comparison-led',
        body: 'Even with motion, the platform promise stays centered on clarity and evaluation.',
        icon: ArrowLeftRight,
      },
    ],
    specialties: ['Dental', 'Hair Restoration', 'Plastic Surgery'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: consultation, daylight, gentle gestures, clear space for the headline.',
    themeName: 'Video-led consultation and daylight trust',
    title: 'Compare clinics abroad with calmer guidance from the first glance.',
    visualVariant: 'videoStage',
  },
  videoProcedureLight: {
    backgroundImage: featureBackground,
    backgroundImageClassName: 'object-[center_42%]',
    bestFor:
      'A motion-led page where the video should show precise treatment context, especially for dental, eye care, or technology-supported care.',
    contactDescription:
      'This direction works best with a short capture flow while the media window does most of the atmospheric work.',
    contactMode: 'compact',
    contactTitle: 'See the first version',
    description:
      'This direction lets findmydoc use bright clinical footage as a differentiator while keeping the page centered on treatment comparison, trust, and informed decisions.',
    eyebrow: 'Treatment comparison with visible clinical motion',
    footerLinks,
    layoutMode: 'video',
    mediaNote: {
      badge: 'Video-first concept',
      description:
        'Short loops of preparation, screens, or instruments can add credibility, as long as the headline and CTA remain the focus.',
      title: 'Clinical motion should feel informative, not dramatic.',
    },
    narrative:
      'Use close but calm footage: a clinician preparing tools, a screen in motion, or hands at work. The video should feel precise and reassuring rather than intense.',
    overlayClassName: 'from-white/96 via-cyan-50/76 to-white/88',
    primaryCtaLabel: 'Join the preview list',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Compare treatments abroad with clearer treatment context, visible trust signals, and a more informed next step on findmydoc.',
      metaTitle: 'Compare Treatments Abroad with More Clarity | Findmydoc',
      primaryKeyword: 'compare treatments abroad',
      searchIntent: 'Comparative with treatment research intent',
    },
    signals: [
      {
        title: 'Motion shows process',
        body: 'The video makes quality and treatment context visible in seconds.',
        icon: CircleGauge,
      },
      {
        title: 'Platform first, footage second',
        body: 'The scene supports the promise, but the page still reads as Findmydoc, not as a clinic ad.',
        icon: ShieldCheck,
      },
    ],
    specialties: ['Dental', 'Eye Care', 'Dermatology'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: clean procedure footage, visible screens, restrained motion, bright surfaces.',
    themeName: 'Video-led precision and treatment context',
    title: 'Compare treatments abroad with a clearer view of care.',
    visualVariant: 'videoSplit',
  },
  videoArrivalWindow: {
    backgroundImage: clinicHospitalExterior,
    backgroundImageClassName: 'object-center',
    bestFor:
      'A travel-aware launch page when the video should carry arrival, location, and treatment-abroad context in a lighter way.',
    contactDescription:
      'Use a simple early-interest capture here. The strongest part of this concept is the bright motion in the media window.',
    contactMode: 'compact',
    contactTitle: 'Stay close to the launch',
    description:
      'A daylight exterior concept makes room for a destination or arrival video while findmydoc still speaks as a trusted clinic comparison platform for medical tourism.',
    eyebrow: 'Medical tourism comparison in a lighter arrival frame',
    footerLinks,
    layoutMode: 'video',
    mediaNote: {
      badge: 'Video-first concept',
      description:
        'Daylight building shots, approach footage, and soft environmental movement are strong when the page should feel international but still medical.',
      title: 'Exterior motion adds place and confidence without crowding the message.',
    },
    narrative:
      'Use exterior movement, people entering, trees, or city approach shots. The page stays platform-led, while the video quietly signals place, access, and confidence.',
    overlayClassName: 'from-white/96 via-emerald-50/72 to-white/88',
    primaryCtaLabel: 'Get launch updates',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Medical tourism clinic comparison needs trust, place, and clarity. Findmydoc connects treatment abroad research with calmer next steps.',
      metaTitle: 'Medical Tourism Clinic Comparison | Findmydoc',
      primaryKeyword: 'medical tourism clinic comparison',
      searchIntent: 'Informational to comparative',
    },
    signals: [
      {
        title: 'Travel context without drift',
        body: 'The motion says destination and arrival, while the content keeps the page firmly medical.',
        icon: Plane,
      },
      {
        title: 'Bright enough for the brand',
        body: 'The exterior video gives movement and openness without pulling the page into a dark visual system.',
        icon: Globe2,
      },
    ],
    specialties: ['Dental', 'Plastic Surgery', 'Hair Restoration'],
    statusLabel: 'Coming Soon',
    supportingNote: 'Reference mood: exterior daylight, leaves, arrival, international but calm.',
    themeName: 'Video-led arrival and treatment abroad',
    title: 'Medical tourism needs a lighter, more trustworthy first impression.',
    visualVariant: 'videoPanorama',
  },
  videoImmersiveHero: {
    backgroundImage: medicalHero,
    backgroundImageClassName: 'object-center',
    bestFor:
      'A launch direction that feels cinematic and calm at once: the video creates immediate presence, then the page steps back and lets trust, clarity, and intent breathe.',
    contactDescription:
      'Capture early interest with a compact form while the fullscreen hero carries the emotional impact of the launch.',
    contactMode: 'compact',
    contactTitle: 'Get first access when we go live',
    description:
      'Findmydoc is launching a clearer way to compare clinics abroad. This immersive hero is built to showcase a premium background video with minimal distraction.',
    eyebrow: 'Trusted treatment decisions start with transparent comparison',
    footerLinks: immersiveHeroFooterLinks,
    heroVideo: {
      loopDurationSeconds: 20,
      posterSrc: clinicHospitalExterior,
      videoSrc: '/stories/immersive-hero-loop.mp4',
      requiredLabel: 'Background video currently unavailable',
    },
    layoutMode: 'video',
    mediaNote: {
      badge: 'Immersive hero',
      description:
        'Use a high-resolution loop with calm medical or arrival motion. The composition is optimized for headline readability and wow impact.',
      title: 'Fullscreen motion should feel premium, bright, and trustworthy.',
    },
    narrative:
      'This direction is intentionally sparse below the fold. The hero does the heavy lifting, then a compact section captures intent and keeps legal links visible.',
    overlayClassName: 'from-white/94 via-sky-50/68 to-white/88',
    primaryCtaLabel: 'Join launch updates',
    searchSnapshot: {
      internalLinks: platformInternalLinks,
      metaDescription:
        'Findmydoc helps you compare clinics abroad with trusted information, clearer choices, and a confident next step before treatment.',
      metaTitle: 'Findmydoc Launch | Compare Clinics Abroad',
      primaryKeyword: 'compare clinics abroad',
      searchIntent: 'Comparative with launch-intent trust',
    },
    signals: [
      {
        title: 'Compare before commitment',
        body: 'Start with side-by-side comparison so treatment choices stay informed and pressure-free.',
        icon: UserRoundSearch,
      },
      {
        title: 'International by design',
        body: 'Cross-border care is easier to evaluate when clinic information is structured and comparable.',
        icon: Globe2,
      },
      {
        title: 'Trust through verified quality',
        body: 'Use ratings, verification status, and accreditations to judge quality with more confidence.',
        icon: ShieldCheck,
      },
    ],
    specialties: ['Dental', 'Eye Care', 'Hair Restoration', 'Plastic Surgery'],
    statusLabel: 'Coming Soon',
    supportingNote:
      'Reference mood: a luminous, premium motion canvas with quiet confidence, minimal words, and the feeling that something meaningful is about to begin.',
    themeName: 'Immersive fullscreen hero',
    title: 'A new way to compare clinics abroad starts here.',
    visualVariant: 'videoImmersiveHero',
  },
}
