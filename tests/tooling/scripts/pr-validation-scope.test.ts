import { describe, expect, it } from 'vitest'
import { requiresApplicationValidation } from '../../../scripts/ci/pr-validation-scope.mjs'

describe('PR application validation scope', () => {
  it('keeps a documentation-only PR eligible without application suites', () => {
    expect(requiresApplicationValidation(['docs/integrations/clinic-dashboard-api.md', 'README.md'])).toBe(false)
  })

  it.each([
    ['src/app/page.tsx'],
    ['docs/contract.md', 'src/auth/session.ts'],
    ['tests/unit/auth.test.ts'],
    ['.github/workflows/deploy.yml'],
    ['package.json', 'pnpm-lock.yaml'],
    ['scripts/ci/pr-validation-scope.mjs'],
    [],
  ])('requires application validation for non-documentation or unclassified changes: %j', (...files) => {
    expect(requiresApplicationValidation(files)).toBe(true)
  })

  it.each([[undefined], [{}], [['README.md', null]]])('fails closed for an invalid changed-path list: %j', (files) => {
    expect(() => requiresApplicationValidation(files)).toThrow('Invalid changed-path list')
  })
})
