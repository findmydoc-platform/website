import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL(
  '../../../src/migrations/20260808_130742_review_versioned_moderation_foundation.ts',
  import.meta.url,
)
const migrationSource = readFileSync(migrationPath, 'utf8')
const upSource = migrationSource.split('export async function down')[0] ?? migrationSource

describe('review versioned moderation foundation migration', () => {
  it('adds review versions and inactive moderation and withdrawal storage', () => {
    expect(upSource).toContain('CREATE TABLE "_reviews_v"')
    expect(upSource).toContain('CREATE TABLE "reviews_rels"')
    expect(upSource).toContain('ALTER TABLE "reviews" ADD COLUMN "public_measure"')
    expect(upSource).toContain('ALTER TABLE "reviews" ADD COLUMN "withdrawal_state"')
    expect(upSource).toContain('CREATE INDEX "reviews_public_measure_idx"')
    expect(upSource).toContain('CREATE INDEX "reviews_withdrawal_state_idx"')
  })

  it('creates one neutral baseline version for reviews without native history', () => {
    expect(upSource).toContain('INSERT INTO "_reviews_v"')
    expect(upSource).toContain('\'none\'::"enum__reviews_v_version_public_measure"')
    expect(upSource).toContain('\'active\'::"enum__reviews_v_version_withdrawal_state"')
    expect(upSource).toContain('WHERE NOT EXISTS (')
    expect(upSource).toContain('"existing_version"."parent_id" = "reviews"."id"')
  })

  it('keeps the forward migration additive and scoped to review storage', () => {
    expect(upSource).not.toContain('DROP TABLE')
    expect(upSource).not.toContain('DROP COLUMN')
    expect(upSource).not.toContain('UPDATE "reviews"')
    expect(upSource).not.toContain('ALTER TABLE "review_responses"')
    expect(upSource).not.toContain('ALTER TABLE "review_appeals"')
  })
})
