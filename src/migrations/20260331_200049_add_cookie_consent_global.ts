import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "cookie_consent" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"consent_version" numeric DEFAULT 1 NOT NULL,
  	"banner_title" varchar DEFAULT 'Cookies on findmydoc' NOT NULL,
  	"banner_description" varchar DEFAULT 'We use essential cookies to keep the site working and optional analytics cookies to understand usage and improve the experience.' NOT NULL,
  	"accept_label" varchar DEFAULT 'Accept all' NOT NULL,
  	"reject_label" varchar DEFAULT 'Reject all' NOT NULL,
  	"customize_label" varchar DEFAULT 'Customize' NOT NULL,
  	"settings_title" varchar DEFAULT 'Cookie settings' NOT NULL,
  	"settings_description" varchar DEFAULT 'Choose which optional cookies you allow. Essential cookies are always active.' NOT NULL,
  	"essential_label" varchar DEFAULT 'Essential cookies' NOT NULL,
  	"essential_description" varchar DEFAULT 'Required for core site functionality, security, and consent persistence.' NOT NULL,
  	"analytics_label" varchar DEFAULT 'Analytics cookies' NOT NULL,
  	"analytics_description" varchar DEFAULT 'Help us understand how the site is used so we can improve it.' NOT NULL,
  	"cancel_label" varchar DEFAULT 'Cancel' NOT NULL,
  	"save_label" varchar DEFAULT 'Save preferences' NOT NULL,
  	"reopen_label" varchar DEFAULT 'Cookie settings' NOT NULL,
  	"privacy_policy_label" varchar DEFAULT 'Privacy Policy' NOT NULL,
  	"privacy_policy_url" varchar DEFAULT '/privacy-policy' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "cookie_consent" CASCADE;`)
}
