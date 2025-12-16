# Package Patches

This project uses [patch-package](https://github.com/ds300/patch-package) to apply fixes to third-party npm packages when necessary.

## Current Patches

### @supabase/supabase-js@2.87.3

**Issue:** The ESM wrapper (`dist/esm/wrapper.mjs`) incorrectly tries to access a default export from `module/index.js` that doesn't exist, causing webpack build failures in Next.js.

**Error:**
```
Attempted import error: '../module/index.js' does not contain a default export (imported as 'index').
```

**Fix:** Modified the wrapper to use only the namespace import without the fallback to `index.default`.

**Patch Location:** `patches/@supabase+supabase-js+2.87.3.patch`

**Status:** This is a temporary workaround. The patch can be removed once Supabase releases a fixed version.

## How Patches Work

1. Patches are automatically applied after `npm install` via the `postinstall` script in `package.json`
2. All patches are stored in the `patches/` directory
3. If you need to create a new patch:
   - Modify the package in `node_modules/`
   - Run `npx patch-package <package-name>`
   - Commit the generated patch file
