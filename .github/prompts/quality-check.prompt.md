# Code Quality Check

Run final quality assurance checks before completing implementation.

## Required Steps
1. **Linting and Typescript Check**
   ```bash
   pnpm check
   ```
   Fix any linting errors with `pnpm lint:fix`

2. **PayloadCMS Specific**
   - Run `pnpm generate:types` if collections were modified
   - Ensure all imports use proper TypeScript types
   - Verify access control functions are imported correctly

## Common Issues
- Missing `required: true` on essential fields
- Missing `index: true` on relationship fields
- Incorrect TypeScript imports
- Missing field descriptions
- Improper access control setup

## Validation Checklist
- [ ] All files use proper TypeScript types
- [ ] Access functions imported from `@/access/`
- [ ] Field descriptions added for user clarity
- [ ] Required fields marked appropriately
- [ ] Relationship fields have indexes
- [ ] PayloadCMS native features used over custom solutions
- [ ] Proper error handling implemented
- [ ] Logging uses correct methods (payload.logger vs console)

## Pre-Completion Requirements
**Must pass both checks:**
- `pnpm lint` with no errors
- `tsc --noEmit` with no type errors

Only mark implementation complete after both checks pass.
