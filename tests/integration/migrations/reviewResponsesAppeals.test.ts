import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'src/migrations/20260729_235647_review_responses_and_appeals.ts')
const migrationSource = readFileSync(migrationPath, 'utf8')

describe('reviewResponses and reviewAppeals migration', () => {
  it('creates one-to-one workflow tables and their native version tables', () => {
    expect(migrationSource).toContain('CREATE TABLE "review_responses"')
    expect(migrationSource).toContain('CREATE TABLE "_review_responses_v"')
    expect(migrationSource).toContain('CREATE TABLE "review_appeals"')
    expect(migrationSource).toContain('CREATE TABLE "_review_appeals_v"')
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "review_responses_review_idx"')
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "review_appeals_review_idx"')
  })

  it('anonymizes deleted staff actors in current and version relation tables', () => {
    const actorForeignKeys = migrationSource
      .split('\n')
      .filter(
        (line) => line.includes('_rels_') && (line.includes('platform_staff_fk') || line.includes('clinic_staff_fk')),
      )

    expect(actorForeignKeys).toHaveLength(8)
    for (const foreignKey of actorForeignKeys) {
      expect(foreignKey).toContain('ON DELETE cascade')
    }
  })

  it('keeps the migration additive for existing review and clinic data', () => {
    const upSource = migrationSource.split('export async function down')[0] ?? migrationSource
    expect(upSource).not.toContain('DROP TABLE "reviews"')
    expect(upSource).not.toContain('ALTER TABLE "reviews" DROP')
    expect(upSource).not.toContain('UPDATE "reviews"')
    expect(upSource).not.toContain('UPDATE "clinics"')
  })
})
