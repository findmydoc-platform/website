/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-in-components',
      severity: 'error',
      comment: 'Avoid circular dependencies in reusable components to keep the atomic stack maintainable.',
      from: {
        path: '^src/components/',
      },
      to: {
        circular: true,
      },
    },
    {
      name: 'no-ui-to-payload-types',
      severity: 'error',
      comment: 'UI components must stay Payload-free. Keep Payload-specific mapping in src/blocks adapters.',
      from: {
        path: '^src/components/',
      },
      to: {
        path: '^src/payload-types(?:\\.ts)?$',
      },
    },
    {
      name: 'atoms-must-not-import-upper-layers',
      severity: 'error',
      comment: 'Atoms must remain leaf-level UI primitives.',
      from: {
        path: '^src/components/atoms/',
      },
      to: {
        path: '^src/components/(molecules|organisms|templates|pages)/',
      },
    },
    {
      name: 'molecules-must-not-import-upper-layers',
      severity: 'error',
      comment: 'Molecules should not depend on organisms, templates, or pages.',
      from: {
        path: '^src/components/molecules/',
      },
      to: {
        path: '^src/components/(organisms|templates|pages)/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    includeOnly: '^src',
    exclude: {
      path: '^(src/migrations|src/app/\\(frontend\\)/fonts)',
    },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    },
    tsConfig: {
      fileName: './tsconfig.json',
    },
  },
}
