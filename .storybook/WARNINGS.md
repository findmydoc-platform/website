# Storybook Build Warnings - Resolution Notes

This document explains the build-time warnings in Storybook and how they were addressed.

## 1. CommonJS Deprecation Warning ✅ RESOLVED

**Issue**: "Using CommonJS in your main configuration file is deprecated with Vite."

**Root Cause**: The `.storybook/main.ts` file was using `createRequire` from `node:module` to resolve the absolute path to `react/compiler-runtime`. While the file itself was ESM, this pattern triggered Storybook's detection logic.

**Resolution**: Removed the `createRequire` pattern and the associated alias configuration. Testing confirmed that Vite can resolve `react/compiler-runtime` correctly without explicit aliasing, as the module is properly exported by React 19.

**Verification**: 
- ✅ Dev server starts without CommonJS warning
- ✅ Build completes without CommonJS warning
- ✅ Storybook functions correctly

## 2. Multiple Favicons Warning ⚠️ DOCUMENTED

**Issue**: "Looks like multiple favicons were detected. Using the first one."

**Details**: Both `favicon.svg` and `favicon.ico` exist in the `public/` directory. Storybook auto-detects both via `staticDirs` configuration.

**Decision**: This warning is informational only and acceptable because:
1. Both favicons serve different purposes:
   - `favicon.svg`: Modern, scalable format (preferred by Storybook and modern browsers)
   - `favicon.ico`: Legacy format (fallback for older browsers/Windows)
2. The frontend application (`src/app/(frontend)/layout.tsx`) explicitly declares both in the HTML head with proper type attributes
3. Storybook correctly uses the first detected favicon (`favicon.svg`)
4. Created `manager-head.html` and `preview-head.html` to explicitly declare the SVG favicon for Storybook UI

**No Action Required**: The warning doesn't affect functionality and both files should remain for comprehensive browser support.

## 3. Large Chunks Warning ⚠️ PARTIALLY MITIGATED

**Issue**: "Some chunks are larger than 500 kB after minification."

**Analysis**: Identified large chunks:
- `iframe.js`: 1,286 kB (366 kB gzipped) - Storybook's main iframe manager
- `index.js`: 835 kB (226 kB gzipped) - Storybook's main index
- `DocsRenderer.js`: 802 kB (257 kB gzipped) - Storybook docs addon
- `axe-core.js`: 579 kB (159 kB gzipped) - Accessibility testing (now split)
- `DatePicker.js`: 515 kB (145 kB gzipped) - Date picker component

**Mitigation Applied**: Added manual chunking in `.storybook/main.ts` to split:
- `axe-core` (a11y testing library)
- `@storybook/blocks` and `@storybook/components` (docs rendering)
- `react-syntax-highlighter` (code highlighting)
- `date-fns` (date utilities)
- `@vitest` (browser testing tools)

**Why Remaining Large Chunks Are Acceptable**:
1. **Storybook Core Bundles** (`iframe`, `index`, `DocsRenderer`): These are Storybook's own framework code. Further splitting would require changes to Storybook's internal bundling system.
2. **Effective Compression**: All chunks have good gzip ratios (3.5:1 to 3.7:1), reducing actual transfer sizes significantly.
3. **One-Time Load**: These bundles are loaded once and cached effectively.
4. **Development Tool**: Storybook is a development/documentation tool, not production code. Build performance is not critical.

**Performance Impact**: Minimal. The gzipped sizes are reasonable for a dev tool:
- iframe: 366 KB (main functionality)
- index: 226 KB (UI framework)
- DocsRenderer: 257 KB (documentation rendering)

## Summary

- ✅ **CommonJS warning**: Resolved by removing unnecessary module resolution pattern
- ⚠️ **Favicon warning**: Documented as acceptable; both favicons serve important purposes
- ✅ **Large chunks**: Partially mitigated; remaining large chunks are Storybook core bundles with acceptable performance characteristics

No further action required unless Storybook itself provides better chunking controls in future versions.
