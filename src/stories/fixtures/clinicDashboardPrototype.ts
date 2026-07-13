import type {
  ClinicDashboardShellData,
  ClinicProfileData,
  ClinicProfileDialogBackdropData,
  DashboardOverviewData,
  MessagesWorkspaceData,
  PatientProfileData,
  ReviewsManagementData,
  TeamMemberDialogData,
  TreatmentDialogData,
} from '@/components/templates/ClinicDashboardPrototype/types'

import { getStoryImageSrc, storyClinicMedia, storyPortraits } from './assets'

const adminAvatar = {
  alt: 'Admin profile portrait',
  src: getStoryImageSrc(storyPortraits.accountMenuAvatar),
}

const patientPortraits = {
  lukas: {
    alt: 'Lukas Weber portrait',
    src: getStoryImageSrc(storyPortraits.testimonials.robertHayes),
  },
  markus: {
    alt: 'Markus Schmidt portrait',
    src: getStoryImageSrc(storyPortraits.testimonials.alexMorgan),
  },
  sarah: {
    alt: 'Sarah Meyer portrait',
    src: getStoryImageSrc(storyPortraits.testimonials.ninaFeld),
  },
}

export const clinicDashboardShellFixture: ClinicDashboardShellData = {
  adminAvatar,
  adminName: 'Admin',
  clinicName: 'Berlin Health Clinic',
}

export const dashboardOverviewFixture: DashboardOverviewData = {
  range: '30',
  metrics: [
    {
      id: 'profile-completion',
      icon: 'verified',
      label: 'Profil-Vollständigkeit',
      progress: 82,
      value: '82%',
    },
    {
      delta: '5.2%',
      description: 'In Suche angezeigt',
      icon: 'visibility',
      id: 'impressions',
      label: 'Impressionen',
      trend: 'up',
      value: '18.420',
    },
    {
      delta: '12%',
      description: 'Geöffnete Seiten',
      icon: 'touch_app',
      id: 'profile-views',
      label: 'Profilaufrufe',
      trend: 'up',
      value: '3.284',
    },
    {
      delta: '2.1%',
      description: 'Chat-Konversationen',
      icon: 'forum',
      id: 'contacts',
      label: 'Kontakte',
      tooltip: 'Nutzer, die die Klinik per Chat kontaktiert haben.',
      trend: 'down',
      value: '42',
    },
    {
      delta: '8.4%',
      description: 'Buchungen / Reserv.',
      icon: 'fact_check',
      id: 'requests',
      label: 'Anfragen',
      tooltip: 'Bestätigte Terminbuchungen oder Reservierungen.',
      trend: 'up',
      value: '16',
    },
  ],
  funnel: [
    { conversion: '17.8% CTR', label: 'Impressionen', value: '18.420' },
    { conversion: '64.1% Visitors', label: 'Profilaufrufe', value: '3.284' },
    { conversion: '1.3% Conversion', label: 'Besucher', value: '2.105' },
    { conversion: '38% Booked', label: 'Kontakte', value: '42' },
    { label: 'Anfragen', value: '16' },
  ],
  profileTasks: [
    { action: 'Beheben', label: 'Fehlende Bilder', priority: 'high' },
    { action: 'Aktivieren', label: 'Offene Arztprofile', priority: 'medium' },
    { action: 'Upload', label: 'Zertifikate erforderlich', priority: 'high' },
    { action: 'Prüfen', label: 'Zertifikat-Ablauf', priority: 'low' },
  ],
  chart: {
    labels: ['01. Okt', '10. Okt', '20. Okt', '30. Okt'],
    points: [15, 45, 62, 52, 20, 55, 95, 90, 48, 45, 85],
    summary: [
      { label: 'Impress.', value: '18.4k' },
      { label: 'Aufrufe', value: '3.2k' },
      { label: 'Besucher', value: '2.1k' },
      { label: 'Anfragen', value: '16' },
    ],
  },
  rating: {
    categories: ['Haartransplantation', 'Zahnimplantate', 'Augenlasern'],
    count: 124,
    value: 4.8,
  },
  clinicPreview: {
    image: storyClinicMedia.exterior,
    location: 'Mitte, Berlin',
    name: 'Berlin Health',
  },
}

export const messagesWorkspaceFixture: MessagesWorkspaceData = {
  activeConversationId: 'lukas-weber',
  composer: {
    internalNoteLabel: 'Interne Notiz (nur Klinik)',
    onlineLabel: 'Der Patient ist gerade online',
    placeholder: 'Nachricht schreiben...',
    templateLabel: 'Vorlagen verwenden',
  },
  conversations: [
    {
      avatar: patientPortraits.lukas,
      category: 'Haartransplantation',
      id: 'lukas-weber',
      name: 'Lukas Weber',
      preview: 'Guten Tag, ich interessiere mich für eine Haartransplantation...',
      section: 'new',
      timestamp: '10:45',
      unreadCount: 1,
    },
    {
      avatar: patientPortraits.markus,
      id: 'markus-schmidt',
      name: 'Markus Schmidt',
      preview: 'Vielen Dank für die Unterlagen. Ich werde sie mir...',
      section: 'recent',
      timestamp: 'Gestern',
    },
    {
      avatar: patientPortraits.sarah,
      id: 'sarah-meyer',
      name: 'Sarah Meyer',
      preview: 'Können wir den Termin am Donnerstag um 10 Uhr...',
      section: 'recent',
      timestamp: 'Mo',
    },
  ],
  dateLabel: 'Heute, 12. Oktober',
  interest: 'Haartransplantation',
  messages: [
    {
      body: 'Guten Tag, ich interessiere mich für eine Haartransplantation in Ihrer Klinik. Könnten Sie mir bitte mitteilen, welche Unterlagen ich für ein erstes Beratungsgespräch vorbereiten sollte?',
      id: 'message-1',
      sender: 'patient',
      timestamp: '10:45',
    },
    {
      body: 'Hallo Herr Weber, vielen Dank für Ihr Interesse! Für die erste Einschätzung benötigen wir in der Regel Fotos der betroffenen Stellen. Sie können diese gerne direkt hier im Chat hochladen.',
      id: 'message-2',
      readReceipt: 'Gelesen 10:52',
      sender: 'clinic',
      timestamp: '10:52',
    },
    {
      additionalAttachmentCount: 2,
      attachments: [
        {
          alt: 'Photo attachment for the initial hair consultation',
          src: storyClinicMedia.treatmentRoom.src,
        },
      ],
      body: 'Hier sind die gewünschten Fotos meiner Haarsituation. Ich hoffe, das hilft für die erste Einschätzung.',
      id: 'message-3',
      sender: 'patient',
      timestamp: '11:02',
    },
  ],
  newCountLabel: '3 Neu',
  patientAvatar: patientPortraits.lukas,
  patientName: 'Lukas Weber',
  patientStatus: 'online',
  requestStatusLabel: 'Anfrage',
  searchPlaceholder: 'Patienten suchen...',
  typingLabel: 'Klinik-Admin schreibt...',
}

export const patientProfileFixture: PatientProfileData = {
  age: '32 Jahre',
  avatar: patientPortraits.lukas,
  contactEmail: 'l.weber@example.com',
  gender: 'Männlich',
  interest: 'Haartransplantation',
  lastVisit: '12.10.2023',
  medicalNotes:
    'Patient klagt über Haarausfall im Tonsurbereich seit ca. 2 Jahren. Keine Vorerkrankungen bekannt. Erstberatung steht aus.',
  name: 'Lukas Weber',
}

export const reviewsManagementFixture: ReviewsManagementData = {
  rating: 4.8,
  totalReviews: 1248,
  distribution: [
    { count: 1023, percent: 82, stars: 5 },
    { count: 150, percent: 12, stars: 4 },
    { count: 50, percent: 4, stars: 3 },
    { count: 18, percent: 1.5, stars: 2 },
    { count: 7, percent: 0.5, stars: 1 },
  ],
  filters: [
    {
      id: 'period',
      label: 'Zeitraum',
      options: [
        { label: 'Letzte 30 Tage', value: '30-days' },
        { label: 'Letzte 90 Tage', value: '90-days' },
        { label: 'Gesamter Zeitraum', value: 'all-time' },
      ],
      value: '30-days',
    },
    {
      id: 'rating',
      label: 'Bewertung',
      options: [
        { label: 'Alle Sterne', value: 'all' },
        { label: 'Positiv (4-5)', value: 'positive' },
        { label: 'Kritisch (1-3)', value: 'critical' },
      ],
      value: 'all',
    },
    {
      id: 'treatment',
      label: 'Behandlung',
      options: [
        { label: 'Alle Behandlungen', value: 'all' },
        { label: 'Haartransplantation', value: 'hair-transplant' },
        { label: 'Zahnmedizin', value: 'dentistry' },
        { label: 'Dermatologie', value: 'dermatology' },
      ],
      value: 'all',
    },
    {
      id: 'status',
      label: 'Status',
      options: [
        { label: 'Alle Status', value: 'all' },
        { label: 'Offen', value: 'open' },
        { label: 'Beantwortet', value: 'answered' },
        { label: 'In Prüfung', value: 'under-review' },
      ],
      value: 'all',
    },
  ],
  reviews: [
    {
      author: 'Markus Schmidt',
      body: 'Hervorragende Beratung und Durchführung. Das Team in der Berlin Health Clinic war von Anfang an sehr professionell. Das Ergebnis sieht jetzt schon super aus, obwohl es erst 3 Monate her ist. Absolute Empfehlung für jeden, der über eine HT nachdenkt.',
      id: 'review-markus-schmidt',
      initials: 'MS',
      rating: 5,
      relativeDate: 'vor 2 Tagen',
      response: {
        body: 'Vielen Dank für das tolle Feedback, Herr Schmidt! Wir freuen uns sehr, dass Sie mit dem Zwischenergebnis zufrieden sind.',
        label: 'Ihre Antwort (Gestern):',
      },
      status: 'answered',
      treatment: 'Haartransplantation',
    },
    {
      author: 'Anonymer Patient',
      body: 'Die Wartezeit war trotz Termin fast 45 Minuten. Die Behandlung an sich war okay, aber das Zeitmanagement muss wirklich besser werden. Personal am Empfang war etwas kurz angebunden.',
      id: 'review-anonymous-patient',
      initials: 'AP',
      rating: 3,
      relativeDate: 'vor 5 Tagen',
      status: 'open',
      treatment: 'Zahnmedizin',
    },
    {
      author: 'Janine Doe',
      body: 'Das war die schlimmste Erfahrung meines Lebens. Der Arzt war unhöflich und... (Dieser Inhalt wird aufgrund eines Einspruchs geprüft)',
      id: 'review-janine-doe',
      initials: 'JD',
      notice:
        'Einspruch am 14.10. eingelegt. Grund: Verstoß gegen Richtlinien (Beleidigung). Rückmeldung wird in 3-5 Werktagen erwartet.',
      rating: 1,
      reference: '#REV-9982',
      relativeDate: 'vor 1 Woche',
      status: 'under-review',
      treatment: 'Unbekannt',
    },
  ],
  pagination: {
    currentPage: 1,
    label: 'Zeige 1-10 von 1,248 Rezensionen',
    totalPages: 3,
  },
}

export const clinicProfileFixture: ClinicProfileData = {
  address: {
    city: 'Berlin',
    phone: '+49 30 12345678',
    postalCode: '10719',
    street: 'Kurfürstendamm 212',
  },
  autosaveMessage: 'Alle Änderungen werden lokal zwischengespeichert.',
  breadcrumbs: ['Kliniken', 'Profil bearbeiten'],
  clinicDescription:
    'Die Berlin Health Clinic ist ein führendes Kompetenzzentrum für ästhetische Zahnheilkunde und Dermatologie. Seit über 15 Jahren bieten wir unseren internationalen Patienten Behandlungen auf höchstem technischem Niveau in einer Atmosphäre von Exzellenz und Vertrauen. Unsere Spezialisierung liegt in der ganzheitlichen Smile-Design-Transformation und modernsten Lasermethoden.',
  clinicName: 'Berlin Health Dental & Derm Clinic',
  gallery: [
    { ...storyClinicMedia.lobby, alt: 'Modern reception area at Berlin Health Clinic' },
    { ...storyClinicMedia.dental, alt: 'Dental treatment room at Berlin Health Clinic' },
    { ...storyClinicMedia.consultation, alt: 'Consultation room at Berlin Health Clinic' },
    { ...storyClinicMedia.hospitalCorridor, alt: 'Hallway at Berlin Health Clinic' },
  ],
  openingHours: [
    { days: 'Mo - Fr', hours: '08:00 - 20:00' },
    { days: 'Sa', hours: '09:00 - 14:00' },
    { closed: true, days: 'So', hours: 'Geschlossen' },
  ],
  specialties: ['Zahnmedizin', 'Dermatologie'],
  team: [
    {
      avatar: {
        alt: 'Dr. Markus Weber portrait',
        src: getStoryImageSrc(storyPortraits.doctor),
      },
      id: 'markus-weber',
      name: 'Dr. Markus Weber',
      specialty: 'Spezialist für Kieferorthopädie',
    },
    {
      avatar: {
        alt: 'Dr. Sarah Schmidt portrait',
        src: getStoryImageSrc(storyPortraits.testimonials.ninaFeld),
      },
      id: 'sarah-schmidt',
      name: 'Dr. Sarah Schmidt',
      specialty: 'Dermatologin & Laserexpertin',
    },
  ],
  treatments: [
    { duration: '60 Min', id: 'laser-whitening', name: 'Zahnaufhellung (Laser)', price: '250€' },
    { duration: '90 Min', id: 'ceramic-veneers', name: 'Keramik-Veneers (pro Zahn)', price: '850€' },
    { duration: '45 Min', id: 'skin-analysis', name: 'Hautanalyse & Treatment', price: '120€' },
  ],
}

export const treatmentDialogFixture: TreatmentDialogData = {
  categories: ['Zahnmedizin', 'Ästhetik', 'Orthopädie'],
  categoryPlaceholder: 'Wählen...',
  descriptionPlaceholder: 'Beschreiben Sie den Ablauf der Behandlung...',
  durationPlaceholder: '30',
  namePlaceholder: 'z.B. Bleaching Express',
  pricePlaceholder: '0,00',
}

export const teamMemberDialogFixture: TeamMemberDialogData = {
  biographyPlaceholder: 'Schreiben Sie ein paar Sätze über die Erfahrung und Expertise des neuen Teammitglieds...',
  firstNamePlaceholder: 'z.B. Dr. Michael',
  lastNamePlaceholder: 'z.B. Schmidt',
  rolePlaceholder: 'Rolle wählen...',
  roles: ['Zahnarzt', 'Dermatologe', 'Medizinische Fachangestellte', 'Klinikleitung / Verwaltung'],
  uploadHint: 'PNG oder JPG bis zu 5MB. Empfohlenes Format: 1:1 Quadratisch.',
}

export const clinicProfileCatalogFixture: ClinicProfileDialogBackdropData = {
  clinicImage: { ...storyClinicMedia.lobby, alt: 'Berlin Health Clinic reception' },
  clinicName: 'Berlin Health Clinic',
  items: [
    {
      category: 'Zahnmedizin',
      duration: '45 Min',
      id: 'professional-cleaning',
      name: 'Professionelle Zahnreinigung',
      price: '85,00 €',
      status: 'Aktiv',
    },
    {
      category: 'Ästhetik',
      duration: '30 Min',
      id: 'hyaluronic-treatment',
      name: 'Hyaluron-Unterspritzung',
      price: '250,00 €',
      status: 'Aktiv',
    },
  ],
  title: 'Leistungskatalog',
  variant: 'treatments',
}

export const clinicTeamBackdropFixture: ClinicProfileDialogBackdropData = {
  clinicName: 'Berlin Health Clinic',
  skeletonCount: 3,
  title: 'Klinik Team',
  variant: 'team',
}
