import { randomUUID } from 'node:crypto'

import { postgresAdapter } from '@payloadcms/db-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createLocalReq, getPayload, type Payload } from 'payload'

import config from '@payload-config'
import {
  down as revertLandingSubscriptionPricingContract,
  up as applyLandingSubscriptionPricingContract,
} from '@/migrations/20260905_135339_landing_subscription_pricing_contract'
import { deriveDatabaseConfig } from '../../../scripts/test-database-harness.mjs'

const { Client } = pg

type IsolatedAdapter = ReturnType<ReturnType<typeof postgresAdapter>['init']>
type RetainedPoolClient = { release: (destroy?: boolean) => void }
type FailClosedDependency = {
  create: string
  drop: string
  name: string
}

const quoteDatabaseIdentifier = (value: string): string => {
  const prefix = 'findmydoc-test'
  const suffix = value.slice(prefix.length)
  if (!value.startsWith(prefix) || !/^[-_][a-z0-9][a-z0-9_-]*$/u.test(suffix) || value.length > 63) {
    throw new Error(`Unsafe isolated migration database name: ${value}`)
  }

  return `"${value}"`
}

describe('landing subscription pricing contract migration', () => {
  let adminClient: InstanceType<typeof Client>
  let isolatedAdapter: IsolatedAdapter
  let isolatedDatabaseName: string
  let payload: Payload
  let retainedAdapterClient: RetainedPoolClient | undefined

  beforeAll(async () => {
    payload = await getPayload({ config })
    const databaseConfig = deriveDatabaseConfig()
    isolatedDatabaseName = `findmydoc-test-migration-${randomUUID().replaceAll('-', '').slice(0, 16)}`
    const isolatedIdentifier = quoteDatabaseIdentifier(isolatedDatabaseName)
    const templateIdentifier = quoteDatabaseIdentifier(databaseConfig.templateDatabaseNames.empty)

    adminClient = new Client({ connectionString: databaseConfig.adminConnectionString })
    await adminClient.connect()
    await adminClient.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [
      databaseConfig.templateDatabaseNames.empty,
    ])
    await adminClient.query(`CREATE DATABASE ${isolatedIdentifier} WITH TEMPLATE ${templateIdentifier}`)

    const isolatedConnectionUrl = new URL(databaseConfig.connectionString)
    isolatedConnectionUrl.pathname = `/${isolatedDatabaseName}`
    isolatedAdapter = postgresAdapter({
      pool: { connectionString: isolatedConnectionUrl.toString() },
      push: false,
    }).init({ payload })
    if (!isolatedAdapter.connect) throw new Error('Expected the isolated PostgreSQL adapter to support connect.')
    await isolatedAdapter.connect()
    retainedAdapterClient = (isolatedAdapter.pool as unknown as { _clients?: RetainedPoolClient[] })._clients?.[0]
    if (!retainedAdapterClient) throw new Error('Expected the isolated adapter to retain one PostgreSQL client.')

    await isolatedAdapter.pool.query(`
      ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_pricing_title" varchar;
      ALTER TABLE "landing_pages" ADD COLUMN "clinic_partners_pricing_description" varchar;
      CREATE TYPE "public"."enum_landing_pages_clinic_partners_pricing_plans_layout" AS ENUM('primary', 'compact');
      CREATE TABLE "landing_pages_clinic_partners_pricing_plans" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "layout" "enum_landing_pages_clinic_partners_pricing_plans_layout" NOT NULL
      );
      CREATE TABLE "landing_pages_clinic_partners_pricing_plans_highlights" (
        "_order" integer NOT NULL,
        "_parent_id" varchar NOT NULL REFERENCES "landing_pages_clinic_partners_pricing_plans"("id"),
        "id" varchar PRIMARY KEY NOT NULL,
        "text" varchar NOT NULL
      );
      CREATE TABLE "landing_pages_clinic_partners_pricing_model" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "title" varchar NOT NULL,
        "description" varchar NOT NULL
      );
      INSERT INTO "landing_pages_clinic_partners_pricing_plans" ("_order", "_parent_id", "id", "layout")
        VALUES (1, 1, 'legacy-plan', 'primary');
      INSERT INTO "landing_pages_clinic_partners_pricing_plans_highlights" ("_order", "_parent_id", "id", "text")
        VALUES (1, 'legacy-plan', 'legacy-highlight', 'Legacy highlight');
      INSERT INTO "landing_pages_clinic_partners_pricing_model" ("_order", "_parent_id", "id", "title", "description")
        VALUES (1, 1, 'legacy-model', 'Legacy model', 'Legacy description');
    `)
  }, 60_000)

  afterAll(async () => {
    retainedAdapterClient?.release(true)
    retainedAdapterClient = undefined
    await isolatedAdapter?.pool.end().catch(() => undefined)
    if (isolatedAdapter?.destroy) await isolatedAdapter.destroy().catch(() => undefined)
    if (adminClient && isolatedDatabaseName) {
      await adminClient.query(`DROP DATABASE IF EXISTS ${quoteDatabaseIdentifier(isolatedDatabaseName)}`)
    }
    await adminClient?.end().catch(() => undefined)
  })

  it('removes the retired storage without cascading and fails closed on rollback', async () => {
    const req = await createLocalReq({}, payload)
    const migrationArgs = { db: isolatedAdapter.drizzle, payload, req } as never

    const failClosedDependencies: FailClosedDependency[] = [
      {
        name: 'landing_subscription_pricing_contract_highlights_sentinel',
        create: `
          CREATE TABLE "landing_subscription_pricing_contract_highlights_sentinel" (
            "id" varchar PRIMARY KEY NOT NULL,
            "highlight_id" varchar NOT NULL REFERENCES "landing_pages_clinic_partners_pricing_plans_highlights"("id")
          );
          INSERT INTO "landing_subscription_pricing_contract_highlights_sentinel" ("id", "highlight_id")
            VALUES ('sentinel', 'legacy-highlight');
        `,
        drop: 'DROP TABLE "landing_subscription_pricing_contract_highlights_sentinel"',
      },
      {
        name: 'landing_subscription_pricing_contract_plans_sentinel',
        create: `
          CREATE TABLE "landing_subscription_pricing_contract_plans_sentinel" (
            "id" varchar PRIMARY KEY NOT NULL,
            "plan_id" varchar NOT NULL REFERENCES "landing_pages_clinic_partners_pricing_plans"("id")
          );
          INSERT INTO "landing_subscription_pricing_contract_plans_sentinel" ("id", "plan_id")
            VALUES ('sentinel', 'legacy-plan');
        `,
        drop: 'DROP TABLE "landing_subscription_pricing_contract_plans_sentinel"',
      },
      {
        name: 'landing_subscription_pricing_contract_model_sentinel',
        create: `
          CREATE TABLE "landing_subscription_pricing_contract_model_sentinel" (
            "id" varchar PRIMARY KEY NOT NULL,
            "pricing_model_id" varchar NOT NULL REFERENCES "landing_pages_clinic_partners_pricing_model"("id")
          );
          INSERT INTO "landing_subscription_pricing_contract_model_sentinel" ("id", "pricing_model_id")
            VALUES ('sentinel', 'legacy-model');
        `,
        drop: 'DROP TABLE "landing_subscription_pricing_contract_model_sentinel"',
      },
      {
        name: 'landing_subscription_pricing_contract_title_sentinel',
        create: `
          CREATE VIEW "landing_subscription_pricing_contract_title_sentinel" AS
          SELECT "clinic_partners_pricing_title"
          FROM "landing_pages";
        `,
        drop: 'DROP VIEW "landing_subscription_pricing_contract_title_sentinel"',
      },
      {
        name: 'landing_subscription_pricing_contract_description_sentinel',
        create: `
          CREATE VIEW "landing_subscription_pricing_contract_description_sentinel" AS
          SELECT "clinic_partners_pricing_description"
          FROM "landing_pages";
        `,
        drop: 'DROP VIEW "landing_subscription_pricing_contract_description_sentinel"',
      },
      {
        name: 'landing_subscription_pricing_contract_layout_sentinel',
        create: `
          CREATE TABLE "landing_subscription_pricing_contract_layout_sentinel" (
            "id" varchar PRIMARY KEY NOT NULL,
            "layout" "enum_landing_pages_clinic_partners_pricing_plans_layout" NOT NULL
          );
          INSERT INTO "landing_subscription_pricing_contract_layout_sentinel" ("id", "layout")
            VALUES ('sentinel', 'primary');
        `,
        drop: 'DROP TABLE "landing_subscription_pricing_contract_layout_sentinel"',
      },
    ]

    for (const dependency of failClosedDependencies) {
      await isolatedAdapter.pool.query(dependency.create)
      await expect(applyLandingSubscriptionPricingContract(migrationArgs)).rejects.toThrow(/Failed query/u)

      const retainedDependency = await isolatedAdapter.pool.query<{ relation: string | null }>(
        `SELECT to_regclass($1)::text AS "relation"`,
        [`public.${dependency.name}`],
      )
      expect(retainedDependency.rows).toEqual([{ relation: dependency.name }])

      await isolatedAdapter.pool.query(dependency.drop)
    }

    await applyLandingSubscriptionPricingContract(migrationArgs)

    const tables = await isolatedAdapter.pool.query<{
      highlights: string | null
      landingPages: string | null
      pricingModel: string | null
      pricingPlans: string | null
    }>(`
      SELECT
        to_regclass('public.landing_pages_clinic_partners_pricing_plans_highlights')::text AS "highlights",
        to_regclass('public.landing_pages')::text AS "landingPages",
        to_regclass('public.landing_pages_clinic_partners_pricing_model')::text AS "pricingModel",
        to_regclass('public.landing_pages_clinic_partners_pricing_plans')::text AS "pricingPlans"
    `)
    expect(tables.rows[0]).toEqual({
      highlights: null,
      landingPages: 'landing_pages',
      pricingModel: null,
      pricingPlans: null,
    })

    const columns = await isolatedAdapter.pool.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'landing_pages'
        AND column_name IN ('clinic_partners_pricing_title', 'clinic_partners_pricing_description')
      ORDER BY column_name
    `)
    expect(columns.rows).toEqual([])

    const enumType = await isolatedAdapter.pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        INNER JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_type.typname = 'enum_landing_pages_clinic_partners_pricing_plans_layout'
      ) AS "exists"
    `)
    expect(enumType.rows).toEqual([{ exists: false }])

    await expect(revertLandingSubscriptionPricingContract(migrationArgs)).rejects.toThrow(
      /Cannot roll back the landing subscription pricing contract/u,
    )
  })
})
