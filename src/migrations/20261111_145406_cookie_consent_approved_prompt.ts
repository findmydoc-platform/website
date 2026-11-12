import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cookie_consent" ALTER COLUMN "banner_title" SET DEFAULT 'Help us improve findmydoc';
  ALTER TABLE "cookie_consent" ALTER COLUMN "banner_description" SET DEFAULT 'With your consent, we analyse page views and clicks, detect technical errors and record browsing sessions. This helps us identify where findmydoc is difficult to use. You can use the website without this analysis and change your choice at any time in Cookie settings.';
  ALTER TABLE "cookie_consent" ALTER COLUMN "customize_label" SET DEFAULT 'Settings';
  ALTER TABLE "cookie_consent" ADD COLUMN "german_prompt_banner_title" varchar DEFAULT 'Hilf uns, findmydoc zu verbessern';
  ALTER TABLE "cookie_consent" ADD COLUMN "german_prompt_banner_description" varchar DEFAULT 'Mit deiner Einwilligung werten wir Seitenaufrufe und Klicks aus, erkennen technische Fehler und zeichnen Nutzungssitzungen auf. So erkennen wir, wo findmydoc schwer zu bedienen ist. Du kannst die Website auch ohne diese Auswertung nutzen und deine Auswahl jederzeit in den Cookie-Einstellungen ändern.';
  ALTER TABLE "cookie_consent" ADD COLUMN "german_prompt_accept_label" varchar DEFAULT 'Alle akzeptieren';
  ALTER TABLE "cookie_consent" ADD COLUMN "german_prompt_reject_label" varchar DEFAULT 'Alle ablehnen';
  ALTER TABLE "cookie_consent" ADD COLUMN "german_prompt_customize_label" varchar DEFAULT 'Einstellungen';`)

  const existing = await payload.findGlobal({ slug: 'cookieConsent', depth: 0, req })
  // A fresh installation receives the approved defaults when the global is first created.
  if (!existing.id) return

  const approved = {
    bannerTitle: 'Help us improve findmydoc',
    bannerDescription:
      'With your consent, we analyse page views and clicks, detect technical errors and record browsing sessions. This helps us identify where findmydoc is difficult to use. You can use the website without this analysis and change your choice at any time in Cookie settings.',
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    customizeLabel: 'Settings',
  }
  const stock = {
    bannerTitle: 'Cookies on findmydoc',
    bannerDescription:
      'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.',
    acceptLabel: 'Accept all',
    rejectLabel: 'Reject all',
    customizeLabel: 'Customize',
  }
  const data: Partial<typeof approved> & { germanPrompt?: typeof existing.germanPrompt } = {}
  const customizedFields: string[] = []
  for (const key of Object.keys(approved) as (keyof typeof approved)[]) {
    if (existing[key] === stock[key]) {
      if (existing[key] !== approved[key]) data[key] = approved[key]
    } else if (existing[key] !== approved[key]) {
      customizedFields.push(key)
    }
  }
  const germanDefaults = {
    bannerTitle: 'Hilf uns, findmydoc zu verbessern',
    bannerDescription:
      'Mit deiner Einwilligung werten wir Seitenaufrufe und Klicks aus, erkennen technische Fehler und zeichnen Nutzungssitzungen auf. So erkennen wir, wo findmydoc schwer zu bedienen ist. Du kannst die Website auch ohne diese Auswertung nutzen und deine Auswahl jederzeit in den Cookie-Einstellungen ändern.',
    acceptLabel: 'Alle akzeptieren',
    rejectLabel: 'Alle ablehnen',
    customizeLabel: 'Einstellungen',
  }
  const germanPrompt = { ...existing.germanPrompt }
  for (const key of Object.keys(germanDefaults) as (keyof typeof germanDefaults)[]) {
    if (germanPrompt[key] == null) {
      germanPrompt[key] = germanDefaults[key]
      data.germanPrompt = germanPrompt
    } else if (germanPrompt[key] !== germanDefaults[key]) {
      customizedFields.push(`germanPrompt.${key}`)
    }
  }
  if (customizedFields.length > 0) {
    payload.logger.warn(
      { fields: customizedFields },
      'Cookie consent copy differs from approved stock; custom values preserved.',
    )
  }
  if (Object.keys(data).length > 0) {
    // Keep the normal afterChange hook so the shared public configuration is invalidated.
    await payload.updateGlobal({ slug: 'cookieConsent', data, depth: 0, req })
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cookie_consent" ALTER COLUMN "banner_title" SET DEFAULT 'Cookies on findmydoc';
  ALTER TABLE "cookie_consent" ALTER COLUMN "banner_description" SET DEFAULT 'We use essential cookies to keep the site working and optional cookies to understand usage and improve the experience.';
  ALTER TABLE "cookie_consent" ALTER COLUMN "customize_label" SET DEFAULT 'Customize';
  ALTER TABLE "cookie_consent" DROP COLUMN "german_prompt_banner_title";
  ALTER TABLE "cookie_consent" DROP COLUMN "german_prompt_banner_description";
  ALTER TABLE "cookie_consent" DROP COLUMN "german_prompt_accept_label";
  ALTER TABLE "cookie_consent" DROP COLUMN "german_prompt_reject_label";
  ALTER TABLE "cookie_consent" DROP COLUMN "german_prompt_customize_label";`)
}
