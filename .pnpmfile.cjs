// These published tools use the JavaScript compiler API absent from TypeScript 7.
const legacyApiConsumers = new Set([
  'typescript-eslint',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/project-service',
  '@typescript-eslint/tsconfig-utils',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/typescript-estree',
  '@typescript-eslint/utils',
  'ts-api-utils',
  'tsconfck',
  '@storybook/react',
  '@joshwooding/vite-plugin-react-docgen-typescript',
  'react-docgen-typescript',
  'eslint-plugin-import',
  'dependency-cruiser',
  '@payloadcms/plugin-mcp',
])

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (!legacyApiConsumers.has(pkg.name)) return pkg

      // pnpm resolves a retained peer against root TypeScript even with a direct dependency.
      if (pkg.peerDependencies) delete pkg.peerDependencies.typescript
      if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript
      pkg.dependencies = { ...pkg.dependencies, typescript: '5.9.3' }
      return pkg
    },
  },
}
