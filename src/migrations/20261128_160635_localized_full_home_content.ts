import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The former global was not localized. Keep its current value in the English source slot.
// Populate German only for the exact source wording from the former baseline.
const knownGermanRenditions: Record<string, Record<string, readonly (readonly [string, string])[]>> = {
  landing_pages: {
    home_seo_title: [
      ['Gain International Patients | Global Clinic Visibility Platform', 'Kliniken in der Türkei vergleichen'],
    ],
    home_seo_description: [
      [
        'Gain international patients through a trusted comparison platform. Increase clinic reach, visibility, and qualified global patient inquiries.',
        'Vergleiche Kliniken für ästhetische Behandlungen und Zahnmedizin in der Türkei. Prüfe Profile, Leistungen und Qualifikationen und kontaktiere Kliniken direkt.',
      ],
    ],
    home_hero_title: [
      [
        'Clinic Comparison Türkiye for Aesthetic Treatments',
        'Kliniken für ästhetische Behandlungen in der Türkei vergleichen',
      ],
    ],
    home_hero_description: [
      [
        'Compare selected aesthetic clinics in Türkiye in a transparent and structured way. Our platform helps you understand treatment options, review clinic information and contact clinics directly with confidence.',
        'Finde Kliniken in der Türkei und vergleiche ihre Behandlungen, Fachgebiete und Qualifikationen. Kontaktiere eine Klinik direkt, wenn du Fragen hast.',
      ],
    ],
    home_testimonials_intro_title: [['Expert feedback', 'Stimmen von Fachleuten']],
    home_testimonials_intro_description: [
      [
        'Perspectives from healthcare and product experts who reviewed the patient decision flow.',
        'Fachleute aus dem Gesundheitswesen und der Produktentwicklung haben den Ablauf aus Patientensicht geprüft.',
      ],
    ],
    home_categories_intro_title: [['Categories', 'Nach Fachgebiet suchen']],
    home_categories_intro_description: [
      [
        'Explore verified clinics by specialty and compare the best options for your needs.',
        'Wähle ein Fachgebiet und vergleiche die Kliniken, die dazu passende Behandlungen anbieten.',
      ],
    ],
    home_features_title: [['Benefits for Patients', 'Was du vergleichen kannst']],
    home_features_description: [
      [
        'Compare verified clinics for dental care, hair transplants, and aesthetic treatments with clear trust signals and transparent profile data.',
        'Hier findest du Angaben zu Zahnbehandlungen, Haartransplantationen und ästhetischen Eingriffen.',
      ],
    ],
    home_process_title: [['How It Works for Patients', 'So findest du eine passende Klinik']],
    home_process_subtitle: [
      [
        'A transparent onboarding flow from profile setup to verified visibility and direct patient inquiries.',
        'Vom ersten Vergleich bis zu deinen Fragen an die Klinik.',
      ],
    ],
    home_faq_title: [['FAQ', 'Häufige Fragen']],
    home_faq_description: [
      [
        'This section answers the most common questions clinics and medical networks have about gaining international patients through our comparison platform.',
        'Fragen zur Suche, zum Klinikvergleich und zur Kontaktaufnahme.',
      ],
    ],
    home_blog_teaser_title: [['From our blog', 'Aus unserem Blog']],
    home_blog_teaser_description: [
      [
        'Explore practical insights, expert perspectives, and the latest topics across health and medicine.',
        'Artikel zur Behandlungsplanung und zu Themen aus Gesundheit und Medizin.',
      ],
    ],
    home_contact_title: [['Contact', 'Kontakt']],
    home_contact_description: [
      [
        'Planning treatment abroad? Share your goals and we will help you find relevant clinics and next steps with confidence.',
        'Du hast Fragen zur Kliniksuche oder zu findmydoc? Schreib uns.',
      ],
    ],
  },
  landing_pages_home_testimonials: {
    quote: [
      [
        'The platform makes treatment research easier by structuring clinic details around what patients need before deciding.',
        'Die Plattform erleichtert die Recherche, weil sie die Klinikdetails danach ordnet, was Patientinnen und Patienten vor einer Entscheidung wissen müssen.',
      ],
      [
        'I appreciate how trust signals are integrated into the comparison flow instead of being hidden in long profile text.',
        'Ich finde gut, dass Informationen zur Vertrauenswürdigkeit direkt im Vergleich stehen und nicht in langen Profiltexten versteckt sind.',
      ],
      [
        'For users planning treatment abroad, the direct contact step is clear, practical, and aligned with real decision journeys.',
        'Für Menschen, die eine Behandlung im Ausland planen, ist der direkte Kontakt verständlich und praktisch. Er passt zu den Entscheidungen, die sie treffen müssen.',
      ],
    ],
    role: [
      ['Digital Health Research Advisor', 'Beraterin für digitale Gesundheitsforschung'],
      ['Healthcare UX Reviewer', 'Tester für Nutzerfreundlichkeit im Gesundheitswesen'],
      ['International Care Pathway Consultant', 'Beraterin für internationale Versorgung'],
    ],
  },
  landing_pages_home_features_items: {
    title: [
      ['Qualified Leads', 'Behandlungen und Fachgebiete'],
      ['Reputation Boost', 'Klinikprofile und Qualifikationen'],
      ['Visibility Increase', 'Direkter Kontakt'],
    ],
    subtitle: [['', '']],
    description: [
      [
        'Compare aesthetic clinics based on treatments, specializations and qualifications. All information is presented clearly to support informed decision making.',
        'Vergleiche die Behandlungen und Fachgebiete der Kliniken an einem Ort.',
      ],
      [
        'Clinics create and manage their own profiles and provide relevant qualifications according to their aesthetic services. This ensures reliable and comparable information.',
        'In den Profilen findest du Angaben der Kliniken über ihr Team, ihre Leistungen und ihre Qualifikationen.',
      ],
      [
        'Patients contact clinics directly without intermediaries, obligations or hidden fees.',
        'Stelle deine Fragen direkt an die Klinik, bevor du über eine Behandlung entscheidest.',
      ],
    ],
  },
  landing_pages_home_process_steps: {
    title: [
      ['Reach Out', 'Kliniken suchen'],
      ['Finalize Profile', 'Profile vergleichen'],
      ['Verification & Quality Check', 'Klinik kontaktieren'],
      ['Connect with Patients', 'Nächste Schritte klären'],
    ],
    description: [
      [
        'You contact us and receive a clear overview of how the platform works, including visibility options, regions, and patient demand.',
        'Wähle ein Fachgebiet oder einen Ort aus, um passende Kliniken zu finden.',
      ],
      [
        'Clinics create and manage their own profiles. This ensures full control over medical information, treatments offered, languages, expertise, and international patient services presented clearly for patient comparison.',
        'Sieh dir die angebotenen Behandlungen und die Angaben zu Team und Qualifikationen an.',
      ],
      [
        'Clinics are required to provide relevant qualifications and certifications according to their medical services. This verification process ensures credibility, transparency, and a high-quality environment for international patients.',
        'Richte Fragen zu einer Behandlung direkt an die Klinik.',
      ],
      [
        'Qualified international patients contact your clinic directly through the platform, ready to discuss treatments, and next steps.',
        'Frag die Klinik nach einem individuellen Angebot, Terminen und der Nachsorge.',
      ],
    ],
  },
  landing_pages_home_faq_items: {
    question: [
      [
        'How does this platform help clinics gain international patients?',
        'Wie finde ich Kliniken für eine bestimmte Behandlung?',
      ],
      ['Are the patient inquiries exclusive?', 'Was kann ich im Klinikvergleich sehen?'],
      ['Which countries and regions are covered?', 'Wie erreiche ich eine Klinik?'],
      ['Is this platform suitable for clinic groups and networks?', 'Wo kann ich nach den Gesamtkosten fragen?'],
      ['Are patient inquiries focused on Europe?', 'An wen kann ich mich mit Fragen zur Website wenden?'],
    ],
    answer: [
      [
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
        'Wähle ein passendes Fachgebiet aus und prüfe im Klinikprofil, welche Behandlungen die Klinik anbietet.',
      ],
      [
        'Inquiries are handled according to your clinic profile settings and availability.',
        'Die Klinikprofile zeigen unter anderem angebotene Behandlungen, Standort und Angaben zum Team und zu Qualifikationen, soweit sie vorliegen.',
      ],
      [
        'Coverage depends on active campaigns and regional demand at the time of listing.',
        'Öffne das Profil der Klinik. Dort kannst du eine Anfrage an die Klinik vorbereiten.',
      ],
      [
        'Yes. Groups can maintain consistent branding while showcasing individual locations.',
        'Bitte die Klinik um ein individuelles Angebot und frage, welche Leistungen und Nachsorgetermine enthalten sind.',
      ],
      [
        'Demand is strongest across Europe, but can include other regions depending on campaigns.',
        'Nutze das Kontaktformular auf dieser Seite, um findmydoc zu erreichen.',
      ],
    ],
  },
}

const localizeGerman = (column: string, renditions: readonly (readonly [string, string])[]) => {
  const cases = renditions.map(([original, german]) => sql`WHEN ${original}::varchar THEN ${german}::varchar`)
  return sql`CASE legacy.${sql.identifier(column)} ${sql.join(cases, sql` `)} END`
}

const defaultHeroStableId = 'landing-home-hero-telemedicine'
const defaultGermanHeroAlt = 'Eine Person vergleicht Klinikprofile auf einem Laptop.'
const previousHeroAlt = (locale: 'de' | 'en') =>
  locale === 'en'
    ? sql`media.alt`
    : sql`CASE WHEN media.stable_id = ${defaultHeroStableId} THEN ${defaultGermanHeroAlt}::varchar END`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "landing_pages_home_testimonials_locales" (
    "quote" varchar,
    "role" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_home_features_items_locales" (
    "title" varchar,
    "subtitle" varchar,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_home_process_steps_locales" (
    "title" varchar,
    "description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_home_faq_items_locales" (
    "question" varchar,
    "answer" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" varchar NOT NULL
  );

  CREATE TABLE "landing_pages_locales" (
    "home_seo_title" varchar,
    "home_seo_description" varchar,
    "home_hero_title" varchar,
    "home_hero_description" varchar,
    "home_hero_image_alt" varchar,
    "home_testimonials_intro_title" varchar,
    "home_testimonials_intro_description" varchar,
    "home_categories_intro_title" varchar,
    "home_categories_intro_description" varchar,
    "home_features_title" varchar,
    "home_features_description" varchar,
    "home_process_title" varchar,
    "home_process_subtitle" varchar,
    "home_faq_title" varchar,
    "home_faq_description" varchar,
    "home_blog_teaser_title" varchar,
    "home_blog_teaser_description" varchar,
    "home_contact_title" varchar,
    "home_contact_description" varchar,
    "id" serial PRIMARY KEY NOT NULL,
    "_locale" "_locales" NOT NULL,
    "_parent_id" integer NOT NULL
  );

  ALTER TABLE "landing_pages_home_testimonials_locales" ADD CONSTRAINT "landing_pages_home_testimonials_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_home_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_features_items_locales" ADD CONSTRAINT "landing_pages_home_features_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_home_features_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_process_steps_locales" ADD CONSTRAINT "landing_pages_home_process_steps_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_home_process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_home_faq_items_locales" ADD CONSTRAINT "landing_pages_home_faq_items_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages_home_faq_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "landing_pages_locales" ADD CONSTRAINT "landing_pages_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "landing_pages_home_testimonials_locales_locale_parent_id_uni" ON "landing_pages_home_testimonials_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_home_testimonials_locales_parent_id_idx" ON "landing_pages_home_testimonials_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_home_features_items_locales_locale_parent_id_u" ON "landing_pages_home_features_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_home_features_items_locales_parent_id_idx" ON "landing_pages_home_features_items_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_home_process_steps_locales_locale_parent_id_un" ON "landing_pages_home_process_steps_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_home_process_steps_locales_parent_id_idx" ON "landing_pages_home_process_steps_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_home_faq_items_locales_locale_parent_id_unique" ON "landing_pages_home_faq_items_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_home_faq_items_locales_parent_id_idx" ON "landing_pages_home_faq_items_locales" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "landing_pages_locales_locale_parent_id_unique" ON "landing_pages_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "landing_pages_locales_parent_id_idx" ON "landing_pages_locales" USING btree ("_parent_id");
  ALTER TABLE "landing_pages_home_testimonials" ALTER COLUMN "quote" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_testimonials" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_features_items" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_features_items" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_process_steps" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_process_steps" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_faq_items" ALTER COLUMN "question" DROP NOT NULL;
  ALTER TABLE "landing_pages_home_faq_items" ALTER COLUMN "answer" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_seo_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_seo_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_hero_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_hero_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_categories_intro_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_categories_intro_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_features_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_features_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_process_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_process_subtitle" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_faq_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_faq_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_blog_teaser_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_blog_teaser_description" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_contact_title" DROP NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_contact_description" DROP NOT NULL;
`)
  // Retain the physical legacy columns for the pre-localization application.
  // Relax their required constraints so the localized application can insert new rows.
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
      Object.entries(fields).map(([column, renditions]) => localizeGerman(column, renditions)),
      sql`, `,
    )

    await db.execute(sql`
      INSERT INTO ${locales} ("_locale", "_parent_id", ${columnList})
      SELECT 'en'::"_locales", legacy.id, ${english} FROM ${parent} AS legacy
      UNION ALL
      SELECT 'de'::"_locales", legacy.id, ${german} FROM ${parent} AS legacy
      ON CONFLICT ("_locale", "_parent_id") DO NOTHING
    `)
  }

  await db.execute(sql`
    UPDATE "landing_pages_locales" localized
    SET "home_hero_image_alt" = CASE
      WHEN localized."_locale" = 'en' THEN ${previousHeroAlt('en')}
      WHEN localized."_locale" = 'de' THEN ${previousHeroAlt('de')}
    END
    FROM "landing_pages" legacy
    JOIN "platform_content_media" media ON media.id = legacy."home_hero_image_id"
    WHERE localized."_parent_id" = legacy.id AND localized."home_hero_image_alt" IS NULL
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The old schema cannot keep new or edited independent renditions.
  // Abort before dropping any locale tables when such edits exist.
  for (const [table, fields] of Object.entries(knownGermanRenditions)) {
    const parent = sql.identifier(table)
    const locales = sql.identifier(`${table}_locales`)
    const changedFields = Object.entries(fields).flatMap(([column, renditions]) => {
      const field = sql.identifier(column)
      return [
        sql`en.${field} IS DISTINCT FROM legacy.${field}`,
        sql`de.${field} IS DISTINCT FROM ${localizeGerman(column, renditions)}`,
      ]
    })

    const { rows } = await db.execute(sql`
      SELECT legacy.id
      FROM ${parent} AS legacy
      LEFT JOIN ${locales} AS en ON en."_parent_id" = legacy.id AND en."_locale" = 'en'
      LEFT JOIN ${locales} AS de ON de."_parent_id" = legacy.id AND de."_locale" = 'de'
      WHERE ${sql.join(changedFields, sql` OR `)}
      LIMIT 1
    `)
    if (rows.length) throw new Error('Cannot revert Home localization after localized copy has been edited.')
  }

  const { rows } = await db.execute(sql`
    SELECT legacy.id
    FROM "landing_pages" AS legacy
    JOIN "landing_pages_locales" AS localized ON localized."_parent_id" = legacy.id
    LEFT JOIN "platform_content_media" AS media ON media.id = legacy."home_hero_image_id"
    WHERE localized."home_hero_image_alt" IS DISTINCT FROM CASE
      WHEN localized."_locale" = 'en' THEN ${previousHeroAlt('en')}
      WHEN localized."_locale" = 'de' THEN ${previousHeroAlt('de')}
    END
    LIMIT 1
  `)
  if (rows.length) throw new Error('Cannot revert Home localization after hero alternative text has been edited.')

  await db.execute(sql`
   DROP TABLE "landing_pages_home_testimonials_locales" CASCADE;
  DROP TABLE "landing_pages_home_features_items_locales" CASCADE;
  DROP TABLE "landing_pages_home_process_steps_locales" CASCADE;
  DROP TABLE "landing_pages_home_faq_items_locales" CASCADE;
  DROP TABLE "landing_pages_locales" CASCADE;
  ALTER TABLE "landing_pages_home_testimonials" ALTER COLUMN "quote" SET NOT NULL;
  ALTER TABLE "landing_pages_home_testimonials" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "landing_pages_home_features_items" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "landing_pages_home_features_items" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "landing_pages_home_process_steps" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "landing_pages_home_process_steps" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "landing_pages_home_faq_items" ALTER COLUMN "question" SET NOT NULL;
  ALTER TABLE "landing_pages_home_faq_items" ALTER COLUMN "answer" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_seo_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_seo_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_hero_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_hero_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_testimonials_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_categories_intro_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_categories_intro_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_features_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_features_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_process_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_process_subtitle" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_faq_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_faq_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_blog_teaser_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_blog_teaser_description" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_contact_title" SET NOT NULL;
  ALTER TABLE "landing_pages" ALTER COLUMN "home_contact_description" SET NOT NULL;
`)
}
