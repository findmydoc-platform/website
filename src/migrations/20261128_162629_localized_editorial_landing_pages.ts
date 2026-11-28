import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Preserve stored English content and derive German only for unchanged baseline wording.
type Renditions = readonly (readonly [string, string])[]
const knownGermanRenditions: Record<string, Record<string, Renditions>> = {
  landing_pages: {
    about_seo_title: [
      ['About findmydoc | Trust system and team accountability', 'Über findmydoc | Vertrauen und Verantwortung'],
    ],
    about_seo_description: [
      [
        'Learn how findmydoc frames clinic signals around trust, transparency, and the team accountability behind the platform.',
        'Erfahren Sie, wie findmydoc Klinikangaben verständlich macht und wer im Team für die Plattform verantwortlich ist.',
      ],
    ],
    about_hero_title: [['About findmydoc', 'Über findmydoc']],
    about_hero_description: [
      [
        'We build findmydoc so patients can compare clinic information with more context, and clinics can present their services responsibly.',
        'Mit findmydoc können Patientinnen und Patienten Klinikangaben besser vergleichen. Kliniken können ihre Leistungen nachvollziehbar darstellen.',
      ],
    ],
    about_why_title: [['Why findmydoc exists', 'Warum es findmydoc gibt']],
    about_transparency_title: [['What stays transparent', 'Was transparent bleibt']],
    clinic_partners_seo_title: [['For Partner Clinics | findmydoc', 'Für Partnerkliniken | findmydoc']],
    clinic_partners_seo_description: [
      [
        'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
        'Machen Sie Ihre Klinik für internationale Patientinnen und Patienten sichtbar. findmydoc unterstützt Kliniken, Klinikgruppen und internationale Patientenbüros mit geprüften Profilen und direkten Anfragen.',
      ],
    ],
    clinic_partners_hero_title: [
      [
        'Gain International Patients Through a Trusted Global Clinic Platform',
        'Internationale Patientinnen und Patienten erreichen',
      ],
    ],
    clinic_partners_hero_description: [
      [
        'Increase your clinic’s international reach and connect with qualified patients worldwide. Our comparison platform helps clinics, medical networks, and international patient departments gain visibility, trust, and high-intent inquiries - globally and sustainably.',
        'Machen Sie Ihre Klinik für internationale Patientinnen und Patienten sichtbar. Über findmydoc können sie geprüfte Klinikprofile vergleichen und Ihrer Klinik direkt eine Anfrage senden.',
      ],
    ],
    clinic_partners_features_title: [['Features', 'Vorteile für Ihre Klinik']],
    clinic_partners_features_description: [
      [
        'Increase your clinic’s visibility, attract qualified patients, and grow internationally through transparent, verified profiles.',
        'Machen Sie Ihre Klinik mit einem geprüften Profil sichtbar und erhalten Sie direkte Anfragen aus dem Ausland.',
      ],
    ],
    clinic_partners_process_title: [['Our Process', 'So läuft die Aufnahme ab']],
    clinic_partners_process_subtitle: [
      [
        'A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.',
        'Vom Anlegen des Profils über die Prüfung bis zur ersten direkten Patientenanfrage.',
      ],
    ],
    clinic_partners_categories_intro_title: [['Our Categories', 'Fachbereiche']],
    clinic_partners_categories_intro_description: [
      [
        'Showcase your clinic under the categories patients search most.',
        'Zeigen Sie Ihre Klinik in den Fachbereichen, nach denen Patientinnen und Patienten suchen.',
      ],
    ],
    clinic_partners_cta_title: [['Let’s work together', 'Werden Sie Partnerklinik']],
    clinic_partners_cta_button_text: [['Contact us', 'Klinikbewerbung starten']],
    clinic_partners_cta_link_url: [['/contact', '/contact']],
    clinic_partners_team_intro_title: [['Our Team', 'Unser Team']],
    clinic_partners_team_intro_description: [
      [
        'We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology. Our focus is simple: helping clinics gain international patients in a sustainable, ethical, and measurable way.',
        'Wir bringen Erfahrung im Gesundheitswesen, in der Betreuung internationaler Patientinnen und Patienten, im Medizinmarketing und in der Plattformentwicklung mit. Wir helfen Kliniken, internationale Patientinnen und Patienten auf verantwortungsvolle und nachvollziehbare Weise zu erreichen.',
      ],
    ],
    clinic_partners_team_cta_button_text: [['About us', 'Über uns']],
    clinic_partners_team_cta_link_url: [['/about', '/about']],
    clinic_partners_testimonials_intro_title: [['Testimonials', 'Stimmen aus dem Gesundheitswesen']],
    clinic_partners_testimonials_intro_description: [
      [
        'Feedback from healthcare and clinic growth experts who reviewed the partner onboarding and visibility model.',
        'Fachleute aus dem Gesundheitswesen und der Klinikentwicklung haben geprüft, wie Kliniken aufgenommen und sichtbar werden.',
      ],
    ],
    clinic_partners_faq_title: [['FAQ', 'Häufige Fragen']],
    clinic_partners_faq_description: [
      [
        'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform. It provides clarity on regions, qualifications, visibility and how clinics connect with international patients across the DACH region and Europe.',
        'Antworten zu Regionen, Qualifikationsnachweisen, Sichtbarkeit und direktem Kontakt mit Patientinnen und Patienten.',
      ],
    ],
    clinic_partners_blog_teaser_title: [['From our blog', 'Aus unserem Blog']],
    clinic_partners_blog_teaser_description: [
      [
        'Explore practical insights, expert perspectives, and the latest topics across health and medicine.',
        'Lesen Sie praktische Hinweise, Beiträge von Fachleuten und aktuelle Artikel zu Gesundheit und Medizin.',
      ],
    ],
    clinic_partners_registration_intro_title: [['Ready for verified visibility?', 'Bewerbung als Partnerklinik']],
    clinic_partners_registration_intro_description: [
      [
        'Share the key details. We review your request personally and follow up with the next steps.',
        'Senden Sie uns die wichtigsten Angaben zu Ihrer Klinik. Wir prüfen Ihre Bewerbung persönlich und melden uns mit den nächsten Schritten.',
      ],
    ],
    clinic_partners_contact_title: [['Kontakt', 'Kontakt']],
    clinic_partners_contact_description: [
      [
        'Interested in gaining international patients and increasing your clinic’s global reach? Contact us to explore how your clinic can benefit from our international comparison platform.',
        'Möchten Sie mit Ihrer Klinik internationale Patientinnen und Patienten erreichen? Sprechen Sie uns auf die Möglichkeiten bei findmydoc an.',
      ],
    ],
  },
  landing_pages_about_why_items: {
    text: [
      [
        'Profile claims, qualifications, reviews, prices, and contact options often arrive as separate signals.',
        'Klinikangaben, Qualifikationen, Bewertungen, Preise und Kontaktmöglichkeiten stehen oft an verschiedenen Stellen.',
      ],
      [
        'findmydoc gives those signals a shared comparison surface before a patient starts a clinic conversation.',
        'findmydoc führt diese Angaben zusammen. So können Patientinnen und Patienten Kliniken vergleichen, bevor sie Kontakt aufnehmen.',
      ],
      [
        'The comparison stays outside medical advice and keeps the decision boundary visible.',
        'Der Vergleich ersetzt keine medizinische Beratung. Die Entscheidung über eine Behandlung bleibt bei Ihnen und Ihrem Behandlungsteam.',
      ],
    ],
  },
  landing_pages_about_team: {
    role: [
      ['CEO', 'CEO'],
      ['CMO', 'CMO'],
      ['CPO', 'CPO'],
      ['CLO', 'CLO'],
      ['CTO', 'CTO'],
    ],
    what_we_do: [
      [
        'Sets partner standards so commercial decisions stay transparent and aligned with responsible clinic relationships.',
        'Legt Standards für Klinikpartnerschaften fest und macht geschäftliche Entscheidungen nachvollziehbar.',
      ],
      [
        'Keeps clinic communication grounded in clear service claims instead of overstated promises.',
        'Achtet darauf, dass Kliniken ihre Leistungen klar darstellen und ihre Aussagen belegen können.',
      ],
      [
        'Shapes comparison flows around patient questions, so profile signals become easier to evaluate.',
        'Richtet den Klinikvergleich an den Fragen der Patientinnen und Patienten aus, damit diese Klinikangaben besser beurteilen können.',
      ],
      [
        'Keeps privacy, legal, and consent expectations visible in patient and clinic interactions.',
        'Achtet darauf, dass Datenschutz, rechtliche Anforderungen und Einwilligungen im Kontakt zwischen Patientinnen, Patienten und Kliniken klar geregelt sind.',
      ],
      [
        'Maintains the platform architecture that keeps profile signals structured, reliable, and accessible.',
        'Verantwortet die technische Architektur, damit Klinikangaben strukturiert, verlässlich und zugänglich bleiben.',
      ],
    ],
  },
  landing_pages_about_transparency_items: {
    text: [
      [
        'Clinics remain accountable for the information shown on their profiles.',
        'Kliniken sind für die Angaben in ihren Profilen verantwortlich.',
      ],
      [
        'Qualification and evidence signals are reviewed before they are presented as trust context.',
        'Wir prüfen Qualifikationen und Nachweise, bevor wir sie im Klinikvergleich als geprüft ausweisen.',
      ],
      [
        'Comparison context stays separate from medical advice, and patients contact clinics directly.',
        'Der Klinikvergleich ersetzt keine medizinische Beratung. Patientinnen und Patienten nehmen direkt mit Kliniken Kontakt auf.',
      ],
    ],
  },
  landing_pages_clinic_partners_features_items: {
    title: [
      ['Qualified Leads', 'Passende Anfragen'],
      ['Reputation Boost', 'Nachvollziehbare Qualifikationen'],
      ['Visibility Increase', 'Mehr Sichtbarkeit'],
    ],
    subtitle: [
      ['Easy & Robust', 'Direkter Patientenkontakt'],
      ['Huge Collection', 'Geprüfte Klinikprofile'],
      ['Responsive & Retina', 'Im deutschsprachigen Raum'],
    ],
    description: [
      [
        'Receive patient inquiries from users actively comparing clinics and treatments. Only relevant and treatment focused leads.',
        'Erhalten Sie Anfragen von Menschen, die bereits Kliniken und Behandlungen vergleichen.',
      ],
      [
        'Strengthen your clinic’s credibility through verified qualifications and transparent profiles that build trust with international patients.',
        'Zeigen Sie Ihre geprüften Qualifikationen in einem transparenten Profil und geben Sie internationalen Patientinnen und Patienten eine verlässliche Grundlage für den Vergleich.',
      ],
      [
        'Increase your clinic’s visibility where international patients search, compare and decide across the DACH region.',
        'Erreichen Sie Patientinnen und Patienten, die in Deutschland, Österreich und der Schweiz nach passenden Kliniken suchen.',
      ],
    ],
  },
  landing_pages_clinic_partners_process_steps: {
    title: [
      ['Reach Out', 'Kontakt aufnehmen'],
      ['Finalize Profile', 'Klinikprofil vervollständigen'],
      ['Verification & Quality Check', 'Qualifikationen prüfen lassen'],
      ['Connect with Patients', 'Patientenanfragen erhalten'],
    ],
    description: [
      [
        'You contact us and receive a clear overview of how the platform works, including visibility options, regions, and patient demand.',
        'Wir erklären Ihnen, wie die Plattform funktioniert, wo Ihr Klinikprofil sichtbar wird und welche Anfragen für Ihre Klinik relevant sein können.',
      ],
      [
        'Clinics create and manage their own profiles. This ensures full control over medical information, treatments offered, languages, expertise, and international patient services presented clearly for patient comparison.',
        'Sie erstellen und pflegen Ihr Klinikprofil. Sie bestimmen, welche Angaben zu Behandlungen, Sprachen, Fachkenntnissen und Angeboten für internationale Patientinnen und Patienten im Vergleich erscheinen.',
      ],
      [
        'Clinics are required to provide relevant qualifications and certifications according to their medical services. This verification process ensures credibility, transparency, and a high-quality environment for international patients.',
        'Reichen Sie die Qualifikationen und Zertifikate ein, die zu Ihren medizinischen Leistungen gehören. Wir prüfen die Nachweise für Ihr Klinikprofil.',
      ],
      [
        'Qualified international patients contact your clinic directly through the platform, ready to discuss treatments, and next steps.',
        'Internationale Patientinnen und Patienten kontaktieren Ihre Klinik direkt über die Plattform, um Behandlungen und nächste Schritte zu besprechen.',
      ],
    ],
  },
  landing_pages_clinic_partners_team: {
    role: [
      ['CEO', 'CEO'],
      ['CMO', 'CMO'],
      ['CPO', 'CPO'],
      ['CLO', 'CLO'],
      ['CTO', 'CTO'],
    ],
  },
  landing_pages_clinic_partners_testimonials: {
    quote: [
      [
        'The clinic onboarding model is well structured and sets clear expectations for profile quality and international visibility.',
        'Die Aufnahme von Kliniken ist klar aufgebaut. Der Ablauf zeigt, welche Anforderungen gelten und wie Profile international sichtbar werden.',
      ],
      [
        'I like that the positioning is not lead-reselling but direct patient contact supported by transparent clinic information.',
        'Mir gefällt, dass Patientinnen und Patienten Kliniken direkt kontaktieren. Transparente Klinikangaben schaffen dafür die Grundlage.',
      ],
      [
        'From an operations perspective, the process is practical: present verified strengths, compare clearly, and move into qualified conversations.',
        'Aus betrieblicher Sicht ist der Ablauf praktikabel. Kliniken weisen ihre Stärken nach, Patientinnen und Patienten können sie vergleichen, und daraus entstehen passende Gespräche.',
      ],
    ],
    role: [
      ['Clinic Growth Advisor', 'Berater für Klinikentwicklung'],
      ['International Patient Services Consultant', 'Beraterin für internationale Patientenservices'],
      ['Healthcare Operations Reviewer', 'Fachprüfer für Abläufe im Gesundheitswesen'],
    ],
  },
  landing_pages_clinic_partners_faq_items: {
    question: [
      [
        'How does this platform help clinics gain international patients?',
        'Wie hilft findmydoc Kliniken, internationale Patientinnen und Patienten zu erreichen?',
      ],
      ['Are the patient inquiries exclusive?', 'Erhält meine Klinik die Anfragen direkt?'],
      ['Which countries and regions are covered?', 'Welche Länder und Regionen deckt findmydoc ab?'],
      [
        'Is this platform suitable for clinic groups and networks?',
        'Eignet sich findmydoc für Klinikgruppen und medizinische Netzwerke?',
      ],
      ['Are patient inquiries focused on Europe?', 'Aus welchen Regionen kommen die Anfragen?'],
    ],
    answer: [
      [
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
        'findmydoc macht Klinikprofile international sichtbar und hilft Patientinnen und Patienten, Kliniken anhand nachvollziehbarer Angaben zu vergleichen.',
      ],
      [
        'Patients contact clinics directly. There are no resold or recycled leads.',
        'Patientinnen und Patienten kontaktieren Ihre Klinik direkt. Wir verkaufen Anfragen nicht weiter.',
      ],
      [
        'Our primary focus is the DACH region (Germany, Austria, Switzerland), while also supporting international patient acquisition across Europe.',
        'Unser Schwerpunkt liegt auf Deutschland, Österreich und der Schweiz. Wir unterstützen Kliniken auch dabei, Patientinnen und Patienten in weiteren europäischen Ländern zu erreichen.',
      ],
      [
        'Yes. We support single clinics, clinic groups, and medical networks with scalable visibility options.',
        'Ja. Einzelne Kliniken, Klinikgruppen und medizinische Netzwerke können ihre Standorte über findmydoc sichtbar machen.',
      ],
      [
        'Most inquiries originate from patients seeking treatment within Europe, with a strong focus on the DACH region.',
        'Die meisten Anfragen kommen von Menschen, die eine Behandlung in Europa suchen. Der Schwerpunkt liegt auf Deutschland, Österreich und der Schweiz.',
      ],
    ],
  },
}

const imageAltFields: Record<string, Record<string, Record<string, string>>> = {
  landing_pages: {
    about_hero_image: {
      'landing-about-hero-startup-team': 'Das Team von findmydoc im Büro',
    },
    clinic_partners_hero_image: {
      'landing-clinic-partner-hero-turkey-tablet':
        'Ein Arzt zeigt einem Patienten das geprüfte Profil seiner Klinik auf einem Tablet',
    },
  },
  landing_pages_clinic_partners_process_steps: {
    image: {
      'landing-partner-process-reach-out': 'Zwei Personen besprechen die Aufnahme einer Klinik in die Plattform',
      'landing-process-create-profile': 'Klinikregistrierung auf einem Smartphone',
      'landing-partner-process-verification': 'Prüfung der Qualifikationsnachweise einer Klinik',
      'landing-partner-process-connect-patients': 'Persönliches Gespräch nach einer Patientenanfrage',
    },
  },
}

const germanValue = (column: string, renditions: Renditions) => {
  const cases = renditions.map(([source, german]) => sql`WHEN ${source}::varchar THEN ${german}::varchar`)
  return sql`CASE legacy.${sql.identifier(column)} ${sql.join(cases, sql` `)} END`
}

const localizedImageAlt = (translations: Record<string, string>) => {
  const cases = Object.entries(translations).map(([id, alt]) => sql`WHEN ${id}::varchar THEN ${alt}::varchar`)
  return sql`CASE WHEN localized."_locale" = 'en' THEN media.alt
    ELSE CASE media.stable_id ${sql.join(cases, sql` `)} END
  END`
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "landing_pages_clinic_partners_features_items_locales" (
    "title" varchar,
    "subtitle" varchar,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_clinic_partners_process_steps_locales" (
    "title" varchar,
    "description" varchar,
    "image_alt" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_clinic_partners_team_locales" (
    "role" varchar,
    "image_alt" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_clinic_partners_testimonials_locales" (
    "quote" varchar,
    "role" varchar,
    "image_alt" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_clinic_partners_faq_items_locales" (
    "question" varchar,
    "answer" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_about_why_items_locales" (
    "text" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_about_team_locales" (
    "role" varchar,
    "image_alt" varchar,
    "what_we_do" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_about_transparency_items_locales" (
    "text" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_seo_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_seo_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_hero_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_hero_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_hero_image_alt" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_features_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_features_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_process_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_process_subtitle" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_categories_intro_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_categories_intro_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_cta_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_cta_button_text" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_cta_link_url" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_team_intro_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_team_intro_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_team_cta_button_text" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_team_cta_link_url" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_testimonials_intro_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_testimonials_intro_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_faq_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_faq_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_blog_teaser_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_blog_teaser_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_registration_intro_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_registration_intro_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_contact_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "clinic_partners_contact_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_seo_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_seo_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_hero_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_hero_description" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_hero_image_alt" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_why_title" varchar;
  ALTER TABLE "landing_pages_locales" ADD COLUMN "about_transparency_title" varchar;
  ALTER TABLE "landing_pages_clinic_partners_features_items_locales" ADD CONSTRAINT "landing_pages_clinic_partners_features_items_locales_pare_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_features_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_process_steps_locales" ADD CONSTRAINT "landing_pages_clinic_partners_process_steps_locales_paren_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_team_locales" ADD CONSTRAINT "landing_pages_clinic_partners_team_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_testimonials_locales" ADD CONSTRAINT "landing_pages_clinic_partners_testimonials_locales_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_clinic_partners_faq_items_locales" ADD CONSTRAINT "landing_pages_clinic_partners_faq_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_clinic_partners_faq_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_about_why_items_locales" ADD CONSTRAINT "landing_pages_about_why_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_about_why_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_about_team_locales" ADD CONSTRAINT "landing_pages_about_team_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_about_team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_about_transparency_items_locales" ADD CONSTRAINT "landing_pages_about_transparency_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_about_transparency_items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "landing_pages_clinic_partners_features_items_locales_locale_" ON "landing_pages_clinic_partners_features_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_features_items_locales_par_idx" ON "landing_pages_clinic_partners_features_items_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_clinic_partners_process_steps_locales_locale_p" ON "landing_pages_clinic_partners_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_process_steps_locales_pare_idx" ON "landing_pages_clinic_partners_process_steps_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_clinic_partners_team_locales_locale_parent_id_" ON "landing_pages_clinic_partners_team_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_team_locales_parent_id_idx" ON "landing_pages_clinic_partners_team_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_clinic_partners_testimonials_locales_locale_pa" ON "landing_pages_clinic_partners_testimonials_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_testimonials_locales_paren_idx" ON "landing_pages_clinic_partners_testimonials_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_clinic_partners_faq_items_locales_locale_paren" ON "landing_pages_clinic_partners_faq_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_clinic_partners_faq_items_locales_parent_i_idx" ON "landing_pages_clinic_partners_faq_items_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_about_why_items_locales_locale_parent_id_uniqu" ON "landing_pages_about_why_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_about_why_items_locales_parent_id_idx" ON "landing_pages_about_why_items_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_about_team_locales_locale_parent_id_unique" ON "landing_pages_about_team_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_about_team_locales_parent_id_idx" ON "landing_pages_about_team_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_about_transparency_items_locales_locale_parent" ON "landing_pages_about_transparency_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_about_transparency_items_locales_parent_id_idx" ON "landing_pages_about_transparency_items_locales" USING btree ("_parent_id");

  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_why_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_transparency_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_seo_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_seo_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_hero_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_hero_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_features_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_features_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_process_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_process_subtitle" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_categories_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_categories_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_cta_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_cta_button_text" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_cta_button_text" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_faq_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_faq_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_blog_teaser_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_blog_teaser_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_contact_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_contact_description" DROP NOT NULL;
  ALTER TABLE "landing_pages_about_why_items" ALTER COLUMN "text" DROP NOT NULL;
  ALTER TABLE "landing_pages_about_team" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "landing_pages_about_team" ALTER COLUMN "what_we_do" DROP NOT NULL;
  ALTER TABLE "landing_pages_about_transparency_items" ALTER COLUMN "text" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_features_items" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_features_items" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_team" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ALTER COLUMN "quote" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_faq_items" ALTER COLUMN "question" DROP NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_faq_items" ALTER COLUMN "answer" DROP NOT NULL;
`)

  for (const [table, fields] of Object.entries(knownGermanRenditions)) {
    const parent = sql.identifier(table)
    const locales = sql.identifier(`${table}_locales`)
    const columns = Object.keys(fields)
    const columnList = sql.join(columns.map(sql.identifier), sql`, `)
    const english = sql.join(
      columns.map((column) => sql`legacy.${sql.identifier(column)}`),
      sql`, `,
    )
    const german = sql.join(
      Object.entries(fields).map(([name, values]) => germanValue(name, values)),
      sql`, `,
    )
    const replacements = sql.join(
      columns.map((name) => {
        const column = sql.identifier(name)
        return sql`${column} = COALESCE(existing.${column}, EXCLUDED.${column})`
      }),
      sql`, `,
    )

    await db.execute(sql`
      INSERT INTO ${locales} AS existing ("_locale", "_parent_id", ${columnList})
      SELECT 'en'::"_locales", legacy.id, ${english} FROM ${parent} AS legacy
      UNION ALL
      SELECT 'de'::"_locales", legacy.id, ${german} FROM ${parent} AS legacy
      ON CONFLICT ("_locale", "_parent_id") DO UPDATE SET ${replacements}
    `)
  }

  for (const [table, fields] of Object.entries(imageAltFields)) {
    for (const [stem, translations] of Object.entries(fields)) {
      const column = sql.identifier(`${stem}_alt`)
      await db.execute(sql`
        UPDATE ${sql.identifier(`${table}_locales`)} localized
        SET ${column} = ${localizedImageAlt(translations)}
        FROM ${sql.identifier(table)} legacy
        JOIN "platform_content_media" media ON media.id = legacy.${sql.identifier(`${stem}_id`)}
        WHERE localized."_parent_id" = legacy.id AND localized.${column} IS NULL
      `)
    }
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  for (const [table, fields] of Object.entries(knownGermanRenditions)) {
    const parent = sql.identifier(table)
    const locales = sql.identifier(`${table}_locales`)
    const changes = Object.entries(fields).flatMap(([column, values]) => {
      const field = sql.identifier(column)
      return [
        sql`en.${field} IS DISTINCT FROM legacy.${field}`,
        sql`de.${field} IS DISTINCT FROM ${germanValue(column, values)}`,
      ]
    })

    const { rows } = await db.execute(sql`
      SELECT legacy.id
      FROM ${parent} AS legacy
      LEFT JOIN ${locales} AS en ON en."_parent_id" = legacy.id AND en."_locale" = 'en'
      LEFT JOIN ${locales} AS de ON de."_parent_id" = legacy.id AND de."_locale" = 'de'
      WHERE ${sql.join(changes, sql` OR `)}
      LIMIT 1
    `)
    if (rows.length)
      throw new Error('Cannot revert localized editorial landing pages after their translations have been edited.')
  }

  for (const [table, fields] of Object.entries(imageAltFields)) {
    for (const [stem, translations] of Object.entries(fields)) {
      const { rows } = await db.execute(sql`
        SELECT legacy.id
        FROM ${sql.identifier(table)} legacy
        JOIN ${sql.identifier(`${table}_locales`)} localized ON localized."_parent_id" = legacy.id
        LEFT JOIN "platform_content_media" media ON media.id = legacy.${sql.identifier(`${stem}_id`)}
        WHERE localized.${sql.identifier(`${stem}_alt`)} IS DISTINCT FROM ${localizedImageAlt(translations)}
        LIMIT 1
      `)
      if (rows.length)
        throw new Error('Cannot revert localized editorial landing pages after alternative text has been edited.')
    }
  }

  await db.execute(sql`
   DROP TABLE "landing_pages_clinic_partners_features_items_locales" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_process_steps_locales" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_team_locales" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_testimonials_locales" CASCADE;
  DROP TABLE "landing_pages_clinic_partners_faq_items_locales" CASCADE;
  DROP TABLE "landing_pages_about_why_items_locales" CASCADE;
  DROP TABLE "landing_pages_about_team_locales" CASCADE;
  DROP TABLE "landing_pages_about_transparency_items_locales" CASCADE;

  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_seo_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_seo_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_hero_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_hero_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_hero_image_alt";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_features_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_features_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_process_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_process_subtitle";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_categories_intro_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_categories_intro_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_cta_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_cta_button_text";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_cta_link_url";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_team_intro_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_team_intro_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_team_cta_button_text";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_team_cta_link_url";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_testimonials_intro_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_testimonials_intro_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_faq_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_faq_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_blog_teaser_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_blog_teaser_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_registration_intro_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_registration_intro_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_contact_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "clinic_partners_contact_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_seo_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_seo_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_hero_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_hero_description";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_hero_image_alt";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_why_title";
  ALTER TABLE "landing_pages_locales" DROP COLUMN "about_transparency_title";
  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_seo_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_hero_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_why_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "about_transparency_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_seo_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_seo_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_hero_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_hero_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_features_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_features_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_process_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_process_subtitle" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_categories_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_categories_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_cta_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_cta_button_text" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_team_cta_button_text" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_testimonials_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_faq_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_faq_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_blog_teaser_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_blog_teaser_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_registration_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_contact_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "clinic_partners_contact_description" SET NOT NULL;
  ALTER TABLE "landing_pages_about_why_items" ALTER COLUMN "text" SET NOT NULL;
  ALTER TABLE "landing_pages_about_team" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "landing_pages_about_team" ALTER COLUMN "what_we_do" SET NOT NULL;
  ALTER TABLE "landing_pages_about_transparency_items" ALTER COLUMN "text" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_features_items" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_features_items" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_process_steps" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_team" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ALTER COLUMN "quote" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_testimonials" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_faq_items" ALTER COLUMN "question" SET NOT NULL;
  ALTER TABLE "landing_pages_clinic_partners_faq_items" ALTER COLUMN "answer" SET NOT NULL;
`)
}
