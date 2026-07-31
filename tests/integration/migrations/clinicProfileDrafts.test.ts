import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../../../src/migrations/20260730_205420_clinic_profile_drafts.ts', import.meta.url)
const migration = readFileSync(migrationPath, 'utf8')

describe('clinic profile drafts migration', () => {
  it('adds persistent revisions and one active draft per clinic without creating draft rows', () => {
    expect(migration).toContain('CREATE TABLE "clinic_profile_drafts"')
    expect(migration).toContain('ALTER TABLE "clinics" ADD COLUMN "profile_revision" numeric DEFAULT 0')
    expect(migration).toContain('CREATE UNIQUE INDEX "clinic_idx"')
    expect(migration).not.toMatch(/INSERT INTO "clinic_profile_drafts"/u)
  })

  it('does not copy coordinates or create audit and event history', () => {
    expect(migration).not.toContain('coordinates')
    expect(migration).not.toMatch(/audit|event/iu)
  })

  it('removes the locked-document relationship before dropping the draft table', () => {
    expect(migration.indexOf('DROP CONSTRAINT "payload_locked_documents_rels_clinic_profile_drafts_fk"')).toBeLessThan(
      migration.indexOf('DROP TABLE "clinic_profile_drafts" CASCADE'),
    )
  })
})
