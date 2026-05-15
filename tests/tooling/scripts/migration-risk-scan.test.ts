import { describe, expect, it } from 'vitest'

import { parseArgs, scanMigrationSource } from '../../../scripts/migration-risk-scan.mjs'

const wrapMigration = (upSql: string, downSql = 'SELECT 1;') => `
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql\`${upSql}\`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql\`${downSql}\`)
}
`

describe('migration-risk-scan argument parsing', () => {
  it('ignores the pnpm -- separator', () => {
    const options = parseArgs(['--', '--base', 'origin/main', '--head', 'HEAD'])

    expect(options.base).toBe('origin/main')
    expect(options.head).toBe('HEAD')
  })

  it('supports explicit changed files', () => {
    const options = parseArgs(['--changed-file=src/migrations/20260501_example.ts'])

    expect(options.changedFiles).toEqual(['src/migrations/20260501_example.ts'])
  })
})

describe('scanMigrationSource', () => {
  it('does not report safe additive migrations', () => {
    const source = wrapMigration('ALTER TABLE "clinics" ADD COLUMN "display_name" varchar;')

    const findings = scanMigrationSource(source, 'src/migrations/20260501_safe.ts')

    expect(findings).toEqual([])
  })

  it('reports destructive drops in the up migration', () => {
    const source = wrapMigration('ALTER TABLE "clinics" DROP COLUMN "legacy_name";')

    const findings = scanMigrationSource(source, 'src/migrations/20260501_drop.ts')

    expect(findings.map((finding) => finding.ruleId)).toContain('drop-column')
  })

  it('ignores destructive statements that only exist in down migrations', () => {
    const source = wrapMigration(
      'ALTER TABLE "clinics" ADD COLUMN "display_name" varchar;',
      'ALTER TABLE "clinics" DROP COLUMN "display_name";',
    )

    const findings = scanMigrationSource(source, 'src/migrations/20260501_down_drop.ts')

    expect(findings).toEqual([])
  })

  it('reports not-null hardening and broad updates', () => {
    const source = wrapMigration(`
      UPDATE "clinics" SET "display_name" = "name";
      ALTER TABLE "clinics" ALTER COLUMN "display_name" SET NOT NULL;
    `)

    const findings = scanMigrationSource(source, 'src/migrations/20260501_hardening.ts')

    expect(findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining(['broad-update', 'set-not-null']))
  })

  it('reports rename and type conversion risks', () => {
    const source = wrapMigration(`
      ALTER TABLE "clinics" RENAME COLUMN "name" TO "display_name";
      ALTER TABLE "clinics" ALTER COLUMN "score" SET DATA TYPE integer USING "score"::integer;
    `)

    const findings = scanMigrationSource(source, 'src/migrations/20260501_rename.ts')

    expect(findings.map((finding) => finding.ruleId)).toEqual(expect.arrayContaining(['rename', 'type-conversion']))
  })
})
