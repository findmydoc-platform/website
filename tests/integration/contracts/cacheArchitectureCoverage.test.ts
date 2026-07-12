import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import {
  CACHE_POLICY_CATALOG,
  CACHE_POLICY_COLLECTIONS,
  CACHE_POLICY_GLOBALS,
  type CachePolicyCatalogEntry,
} from '@/utilities/cachePolicy'

const repositoryRoot = process.cwd()
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const NEXT_CACHE_MODULES = new Set(['next/cache', 'next/cache.js'])
const DIRECT_INVALIDATION_IMPORTS = new Set(['revalidateTag', 'revalidatePath'])
const CACHE_COMPONENT_FUNCTIONS = new Set(['cacheTag', 'cacheLife'])
const EXECUTOR_RELATIVE_PATH = 'src/utilities/cacheRevalidation/executor.ts'
const MEDIA_EXCEPTION_RELATIVE_PATH = 'src/hooks/media/revalidateMediaConsumers.ts'
const MEDIA_EXCEPTION_ISSUE = '#1468'

type RepositorySource = {
  readonly relativePath: string
  readonly source: string
}

type SourceSlug = {
  readonly location: string
  readonly slug: string
}

type PayloadConfigKind = 'collection' | 'global'

type PayloadConfigSlugScan = {
  readonly slugs: readonly SourceSlug[]
  readonly violations: readonly string[]
}

type SourceSlugScan = {
  readonly slugs: readonly string[]
  readonly violations: readonly string[]
}

type CatalogCoverageEntry = {
  readonly boundary?: CachePolicyCatalogEntry['boundary']
  readonly cacheClass?: CachePolicyCatalogEntry['cacheClass']
  readonly collections?: readonly string[]
  readonly globals?: readonly string[]
}

type LocalTagFunction = ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression

type LocalTagDefinitions = {
  readonly expressions: ReadonlyMap<string, ts.Expression>
  readonly functions: ReadonlyMap<string, LocalTagFunction>
}

type TagExpressionAnalysis = {
  readonly containsLiteral: boolean
  readonly isPolicyDerived: boolean
}

const normalizeRelativePath = (filePath: string): string => filePath.split(path.sep).join('/')

const toRepositoryRelativePath = (filePath: string): string =>
  normalizeRelativePath(path.relative(repositoryRoot, filePath))

const isSourceFilePath = (filePath: string): boolean =>
  SOURCE_EXTENSIONS.has(path.extname(filePath)) && !filePath.endsWith('.d.ts')

const walkSourceFiles = (directory: string): string[] => {
  const files: string[] = []
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(entryPath))
      continue
    }

    if (entry.isFile() && isSourceFilePath(entryPath)) {
      files.push(entryPath)
    }
  }

  return files
}

const readSourcesUnder = (relativeDirectory: string): RepositorySource[] => {
  const directory = path.join(repositoryRoot, relativeDirectory)

  return walkSourceFiles(directory).map((filePath) => ({
    relativePath: toRepositoryRelativePath(filePath),
    source: fs.readFileSync(filePath, 'utf8'),
  }))
}

const readNextConfigSources = (): RepositorySource[] =>
  fs
    .readdirSync(repositoryRoot)
    .filter((name) => name.startsWith('next.config.') && isSourceFilePath(name))
    .sort()
    .map((name) => {
      const filePath = path.join(repositoryRoot, name)

      return {
        relativePath: name,
        source: fs.readFileSync(filePath, 'utf8'),
      }
    })

const scriptKindFor = (filePath: string): ts.ScriptKind => {
  const extension = path.extname(filePath)

  if (extension === '.tsx') return ts.ScriptKind.TSX
  if (extension === '.jsx') return ts.ScriptKind.JSX
  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') return ts.ScriptKind.JS

  return ts.ScriptKind.TS
}

const parseSource = ({ relativePath, source }: RepositorySource): ts.SourceFile =>
  ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKindFor(relativePath))

const visitNodes = (sourceFile: ts.SourceFile, visitor: (node: ts.Node) => void): void => {
  const visit = (node: ts.Node): void => {
    visitor(node)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

const getPropertyName = (name: ts.PropertyName): string | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }

  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text
  }

  return null
}

const getObjectPropertyInitializer = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && getPropertyName(property.name) === name) {
      return property.initializer
    }

    if (ts.isShorthandPropertyAssignment(property) && getPropertyName(property.name) === name) {
      return property.name
    }
  }

  return undefined
}

const getTypeReferenceName = (type: ts.TypeNode | undefined): string | null => {
  if (!type || !ts.isTypeReferenceNode(type)) {
    return null
  }

  return ts.isIdentifier(type.typeName) ? type.typeName.text : type.typeName.right.text
}

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  if (ts.isParenthesizedExpression(expression)) return unwrapExpression(expression.expression)
  if (ts.isAsExpression(expression)) return unwrapExpression(expression.expression)
  if (ts.isTypeAssertionExpression(expression)) return unwrapExpression(expression.expression)
  if (ts.isSatisfiesExpression(expression)) return unwrapExpression(expression.expression)

  return expression
}

const getPayloadConfigTypeName = (declaration: ts.VariableDeclaration): string | null => {
  const annotatedTypeName = getTypeReferenceName(declaration.type)
  if (annotatedTypeName) {
    return annotatedTypeName
  }

  let expression = declaration.initializer
  while (expression) {
    if (
      ts.isSatisfiesExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression)
    ) {
      const assertedTypeName = getTypeReferenceName(expression.type)
      if (assertedTypeName) {
        return assertedTypeName
      }

      expression = expression.expression
      continue
    }

    if (ts.isParenthesizedExpression(expression)) {
      expression = expression.expression
      continue
    }

    return null
  }

  return null
}

const getSourceLocation = (sourceFile: ts.SourceFile, node: ts.Node, relativePath: string): string => {
  const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))

  return `${relativePath}:${location.line + 1}`
}

const readPayloadConfigSlugs = ({
  relativePath,
  source,
  kind,
}: RepositorySource & { readonly kind: PayloadConfigKind }): PayloadConfigSlugScan => {
  const sourceFile = parseSource({ relativePath, source })
  const configTypeName = kind === 'collection' ? 'CollectionConfig' : 'GlobalConfig'
  const slugs: SourceSlug[] = []
  const violations: string[] = []

  visitNodes(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || getPayloadConfigTypeName(node) !== configTypeName) {
      return
    }

    const location = getSourceLocation(sourceFile, node, relativePath)
    const config = unwrapExpression(node.initializer)
    if (!ts.isObjectLiteralExpression(config)) {
      violations.push(`${location} uses a non-literal ${kind} config; cache policy coverage requires a static slug.`)
      return
    }

    const slug = getObjectPropertyInitializer(config, 'slug')
    if (!slug) {
      violations.push(`${location} is missing a static ${kind} slug.`)
      return
    }

    const normalizedSlug = unwrapExpression(slug)
    if (!ts.isStringLiteral(normalizedSlug) && !ts.isNoSubstitutionTemplateLiteral(normalizedSlug)) {
      violations.push(`${location} has a non-literal ${kind} slug; cache policy coverage requires a static slug.`)
      return
    }

    slugs.push({ location, slug: normalizedSlug.text })
  })

  return { slugs, violations: sortedUnique(violations) }
}

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort()

const readSourceSlugScan = (relativeDirectory: string, kind: PayloadConfigKind): SourceSlugScan => {
  const scans = readSourcesUnder(relativeDirectory).map((source) => readPayloadConfigSlugs({ ...source, kind }))

  return {
    slugs: sortedUnique(scans.flatMap((scan) => scan.slugs.map((record) => record.slug))),
    violations: sortedUnique(scans.flatMap((scan) => scan.violations)),
  }
}

const catalogValues = (catalog: readonly CatalogCoverageEntry[], key: 'collections' | 'globals'): string[] =>
  sortedUnique(catalog.flatMap((entry) => entry[key] ?? []))

const getPolicyCoverageViolations = ({
  catalog,
  knownCollections,
  knownGlobals,
  sourceCollections,
  sourceGlobals,
}: {
  readonly catalog: readonly CatalogCoverageEntry[]
  readonly knownCollections: readonly string[]
  readonly knownGlobals: readonly string[]
  readonly sourceCollections: readonly string[]
  readonly sourceGlobals: readonly string[]
}): string[] => {
  const knownCollectionSet = new Set(knownCollections)
  const knownGlobalSet = new Set(knownGlobals)
  const catalogCollectionValues = catalogValues(catalog, 'collections')
  const catalogGlobalValues = catalogValues(catalog, 'globals')
  const catalogCollectionSet = new Set(catalogCollectionValues)
  const catalogGlobalSet = new Set(catalogGlobalValues)
  const violations: string[] = []

  for (const slug of sourceCollections) {
    if (!knownCollectionSet.has(slug)) {
      violations.push(`Collection "${slug}" is missing from CACHE_POLICY_COLLECTIONS.`)
      continue
    }

    if (!catalogCollectionSet.has(slug)) {
      violations.push(`Collection "${slug}" is missing from CACHE_POLICY_CATALOG.`)
    }
  }

  for (const slug of sourceGlobals) {
    if (!knownGlobalSet.has(slug)) {
      violations.push(`Global "${slug}" is missing from CACHE_POLICY_GLOBALS.`)
      continue
    }

    if (!catalogGlobalSet.has(slug)) {
      violations.push(`Global "${slug}" is missing from CACHE_POLICY_CATALOG.`)
    }
  }

  for (const slug of knownCollections) {
    if (!catalogCollectionSet.has(slug)) {
      violations.push(`CACHE_POLICY_COLLECTIONS contains "${slug}" without a CACHE_POLICY_CATALOG classification.`)
    }
  }

  for (const slug of knownGlobals) {
    if (!catalogGlobalSet.has(slug)) {
      violations.push(`CACHE_POLICY_GLOBALS contains "${slug}" without a CACHE_POLICY_CATALOG classification.`)
    }
  }

  for (const slug of catalogCollectionValues) {
    if (!knownCollectionSet.has(slug)) {
      violations.push(`CACHE_POLICY_CATALOG references unknown collection "${slug}".`)
    }
  }

  for (const slug of catalogGlobalValues) {
    if (!knownGlobalSet.has(slug)) {
      violations.push(`CACHE_POLICY_CATALOG references unknown global "${slug}".`)
    }
  }

  return sortedUnique(violations)
}

const getModuleSpecifierText = (node: ts.ImportDeclaration | ts.ExportDeclaration): string | null =>
  node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null

const isNextCacheModule = (node: ts.ImportDeclaration | ts.ExportDeclaration): boolean => {
  const moduleSpecifier = getModuleSpecifierText(node)

  return Boolean(moduleSpecifier && NEXT_CACHE_MODULES.has(moduleSpecifier))
}

const allowsDirectInvalidation = (relativePath: string): boolean =>
  relativePath === EXECUTOR_RELATIVE_PATH || relativePath === MEDIA_EXCEPTION_RELATIVE_PATH

const directInvalidationBoundaryMessage = (relativePath: string): string =>
  `${relativePath} bypasses the planner/executor boundary. Direct revalidation belongs in ${EXECUTOR_RELATIVE_PATH}; ${MEDIA_EXCEPTION_RELATIVE_PATH} is the only temporary exception until ${MEDIA_EXCEPTION_ISSUE}.`

const cacheComponentsBoundaryMessage = (relativePath: string, primitive: string): string =>
  `${relativePath} uses ${primitive}, but ADR 023 keeps Cache Components out of the first stack. Add an ADR and migration work order before introducing this primitive.`

const findNextCacheViolations = ({ relativePath, source }: RepositorySource): string[] => {
  const sourceFile = parseSource({ relativePath, source })
  const directInvalidationLocalNames = new Set(DIRECT_INVALIDATION_IMPORTS)
  const violations: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement) && isNextCacheModule(statement)) {
      violations.push(`${relativePath} re-exports next/cache and bypasses the executor boundary.`)
      continue
    }

    if (!ts.isImportDeclaration(statement) || !isNextCacheModule(statement)) {
      continue
    }

    const importClause = statement.importClause
    if (!importClause) {
      violations.push(`${relativePath} uses a side-effect next/cache import, which is not allowed.`)
      continue
    }

    if (importClause.name) {
      violations.push(`${relativePath} uses a default next/cache import, which is not allowed.`)
    }

    if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
      violations.push(`${relativePath} uses a namespace next/cache import, which is not allowed.`)
      continue
    }

    if (!importClause.namedBindings || !ts.isNamedImports(importClause.namedBindings)) {
      continue
    }

    for (const element of importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text
      if (DIRECT_INVALIDATION_IMPORTS.has(importedName)) {
        directInvalidationLocalNames.add(element.name.text)

        if (!allowsDirectInvalidation(relativePath)) {
          violations.push(directInvalidationBoundaryMessage(relativePath))
        }
      }

      if (CACHE_COMPONENT_FUNCTIONS.has(importedName)) {
        violations.push(cacheComponentsBoundaryMessage(relativePath, importedName))
      }
    }
  }

  visitNodes(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) {
      return
    }

    const firstArgument = node.arguments[0]
    const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
    const isRequireCall = ts.isIdentifier(node.expression) && node.expression.text === 'require'
    if (
      (isDynamicImport || isRequireCall) &&
      firstArgument &&
      ts.isStringLiteral(firstArgument) &&
      NEXT_CACHE_MODULES.has(firstArgument.text)
    ) {
      violations.push(`${relativePath} loads next/cache dynamically, which is not allowed.`)
    }

    if (
      ts.isIdentifier(node.expression) &&
      directInvalidationLocalNames.has(node.expression.text) &&
      !allowsDirectInvalidation(relativePath)
    ) {
      violations.push(directInvalidationBoundaryMessage(relativePath))
    }
  })

  return sortedUnique(violations)
}

const collectLocalTagDefinitions = (sourceFile: ts.SourceFile): LocalTagDefinitions => {
  const expressions = new Map<string, ts.Expression>()
  const functions = new Map<string, LocalTagFunction>()

  visitNodes(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.set(node.name.text, node)
      return
    }

    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) {
      return
    }

    if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
      functions.set(node.name.text, node.initializer)
      return
    }

    expressions.set(node.name.text, node.initializer)
  })

  return { expressions, functions }
}

const getNamedImportLocalNames = (
  sourceFile: ts.SourceFile,
  importedName: string,
  moduleMatcher: (value: string) => boolean,
) => {
  const localNames = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue

    const moduleSpecifier = getModuleSpecifierText(statement)
    if (!moduleSpecifier || !moduleMatcher(moduleSpecifier)) continue

    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue

    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text
      if (imported === importedName) {
        localNames.add(element.name.text)
      }
    }
  }

  return localNames
}

const getPolicyBuilderLocalNames = (sourceFile: ts.SourceFile): Set<string> => {
  const localNames = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue

    const moduleSpecifier = getModuleSpecifierText(statement)
    if (!moduleSpecifier || !moduleSpecifier.includes('cachePolicy')) continue

    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue

    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text
      if (imported.startsWith('build') && imported.endsWith('Tag')) {
        localNames.add(element.name.text)
      }
    }
  }

  return localNames
}

const getFunctionReturnExpressions = (functionLike: LocalTagFunction): ts.Expression[] => {
  if (ts.isArrowFunction(functionLike) && !ts.isBlock(functionLike.body)) {
    return [functionLike.body]
  }

  if (!functionLike.body || !ts.isBlock(functionLike.body)) {
    return []
  }

  return functionLike.body.statements.flatMap((statement) =>
    ts.isReturnStatement(statement) && statement.expression ? [statement.expression] : [],
  )
}

const mergeTagExpressionAnalyses = (analyses: readonly TagExpressionAnalysis[]): TagExpressionAnalysis => ({
  containsLiteral: analyses.some((analysis) => analysis.containsLiteral),
  isPolicyDerived: analyses.length > 0 && analyses.every((analysis) => analysis.isPolicyDerived),
})

const analyzeTagExpression = (
  expression: ts.Expression,
  definitions: LocalTagDefinitions,
  policyBuilderLocalNames: ReadonlySet<string>,
  visiting: ReadonlySet<string> = new Set(),
): TagExpressionAnalysis => {
  const unwrapped = unwrapExpression(expression)

  if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return { containsLiteral: true, isPolicyDerived: false }
  }

  if (ts.isArrayLiteralExpression(unwrapped)) {
    if (unwrapped.elements.length === 0) {
      return { containsLiteral: false, isPolicyDerived: false }
    }

    return mergeTagExpressionAnalyses(
      unwrapped.elements.map((element) =>
        ts.isSpreadElement(element)
          ? analyzeTagExpression(element.expression, definitions, policyBuilderLocalNames, visiting)
          : analyzeTagExpression(element, definitions, policyBuilderLocalNames, visiting),
      ),
    )
  }

  if (ts.isConditionalExpression(unwrapped)) {
    return mergeTagExpressionAnalyses([
      analyzeTagExpression(unwrapped.whenTrue, definitions, policyBuilderLocalNames, visiting),
      analyzeTagExpression(unwrapped.whenFalse, definitions, policyBuilderLocalNames, visiting),
    ])
  }

  if (ts.isCallExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
    const name = unwrapped.expression.text
    if (policyBuilderLocalNames.has(name)) {
      return { containsLiteral: false, isPolicyDerived: true }
    }

    const functionLike = definitions.functions.get(name)
    if (functionLike) {
      const reference = `function:${name}`
      if (visiting.has(reference)) return { containsLiteral: false, isPolicyDerived: false }

      const nextVisiting = new Set(visiting)
      nextVisiting.add(reference)
      return mergeTagExpressionAnalyses(
        getFunctionReturnExpressions(functionLike).map((result) =>
          analyzeTagExpression(result, definitions, policyBuilderLocalNames, nextVisiting),
        ),
      )
    }
  }

  if (ts.isIdentifier(unwrapped)) {
    const initializer = definitions.expressions.get(unwrapped.text)
    if (initializer) {
      const reference = `expression:${unwrapped.text}`
      if (visiting.has(reference)) return { containsLiteral: false, isPolicyDerived: false }

      const nextVisiting = new Set(visiting)
      nextVisiting.add(reference)
      return analyzeTagExpression(initializer, definitions, policyBuilderLocalNames, nextVisiting)
    }
  }

  return { containsLiteral: false, isPolicyDerived: false }
}

const findUnstableCacheTagViolations = ({ relativePath, source }: RepositorySource): string[] => {
  const sourceFile = parseSource({ relativePath, source })
  const unstableCacheLocalNames = getNamedImportLocalNames(sourceFile, 'unstable_cache', (moduleSpecifier) =>
    NEXT_CACHE_MODULES.has(moduleSpecifier),
  )
  const policyBuilderLocalNames = getPolicyBuilderLocalNames(sourceFile)
  const definitions = collectLocalTagDefinitions(sourceFile)
  const violations: string[] = []

  visitNodes(sourceFile, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      !unstableCacheLocalNames.has(node.expression.text)
    ) {
      return
    }

    const options = node.arguments[2]
    const unwrappedOptions = options ? unwrapExpression(options) : undefined
    if (!unwrappedOptions || !ts.isObjectLiteralExpression(unwrappedOptions)) {
      violations.push(`${relativePath} calls unstable_cache without an analyzable tags configuration.`)
      return
    }

    const tags = getObjectPropertyInitializer(unwrappedOptions, 'tags')
    if (!tags) {
      violations.push(`${relativePath} calls unstable_cache without cachePolicy-derived tags.`)
      return
    }

    const analysis = analyzeTagExpression(tags, definitions, policyBuilderLocalNames)
    if (analysis.containsLiteral) {
      violations.push(`${relativePath} uses a literal unstable_cache tag. Use cachePolicy builders instead.`)
    }

    if (!analysis.isPolicyDerived) {
      violations.push(`${relativePath} uses unstable_cache tags that do not derive from cachePolicy builders.`)
    }
  })

  return sortedUnique(violations)
}

const findCacheComponentsViolations = ({ relativePath, source }: RepositorySource): string[] => {
  const sourceFile = parseSource({ relativePath, source })
  const violations: string[] = []

  visitNodes(sourceFile, (node) => {
    if (ts.isPropertyAssignment(node) && getPropertyName(node.name) === 'cacheComponents') {
      violations.push(cacheComponentsBoundaryMessage(relativePath, 'cacheComponents'))
      return
    }

    if (ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === 'use cache') {
      violations.push(cacheComponentsBoundaryMessage(relativePath, "'use cache'"))
      return
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      CACHE_COMPONENT_FUNCTIONS.has(node.expression.text)
    ) {
      violations.push(cacheComponentsBoundaryMessage(relativePath, node.expression.text))
    }
  })

  return sortedUnique(violations)
}

describe('Cache architecture coverage gate', () => {
  it('uses the TypeScript AST to read configured slugs without matching comments', () => {
    const scan = readPayloadConfigSlugs({
      kind: 'collection',
      relativePath: 'src/collections/Example.ts',
      source:
        "import type { CollectionConfig } from 'payload'\n// slug: 'ignored'\nexport const Example: CollectionConfig<'example'> = { slug: 'example' }\n",
    })

    expect(scan).toEqual({
      slugs: [{ location: 'src/collections/Example.ts:3', slug: 'example' }],
      violations: [],
    })
  })

  it('rejects a dynamic collection or global slug before it can bypass policy coverage', () => {
    const collectionScan = readPayloadConfigSlugs({
      kind: 'collection',
      relativePath: 'src/collections/Example.ts',
      source:
        "import type { CollectionConfig } from 'payload'\nconst slug = 'example'\nexport const Example: CollectionConfig = { slug }\n",
    })
    const globalScan = readPayloadConfigSlugs({
      kind: 'global',
      relativePath: 'src/globals/Example.ts',
      source:
        "import type { GlobalConfig } from 'payload'\nconst slug = 'example'\nexport const Example: GlobalConfig = { slug }\n",
    })

    expect(collectionScan.slugs).toEqual([])
    expect(collectionScan.violations).toContain(
      'src/collections/Example.ts:3 has a non-literal collection slug; cache policy coverage requires a static slug.',
    )
    expect(globalScan.slugs).toEqual([])
    expect(globalScan.violations).toContain(
      'src/globals/Example.ts:3 has a non-literal global slug; cache policy coverage requires a static slug.',
    )
  })

  it('keeps every collection and global source slug classified by the policy catalog', () => {
    const collectionScan = readSourceSlugScan('src/collections', 'collection')
    const globalScan = readSourceSlugScan('src/globals', 'global')

    expect([...collectionScan.violations, ...globalScan.violations]).toEqual([])
    expect(
      getPolicyCoverageViolations({
        catalog: CACHE_POLICY_CATALOG,
        knownCollections: CACHE_POLICY_COLLECTIONS,
        knownGlobals: CACHE_POLICY_GLOBALS,
        sourceCollections: collectionScan.slugs,
        sourceGlobals: globalScan.slugs,
      }),
    ).toEqual([])
  })

  it('fails for a new collection or global without a catalog classification', () => {
    const violations = getPolicyCoverageViolations({
      catalog: [],
      knownCollections: ['new-collection'],
      knownGlobals: ['new-global'],
      sourceCollections: ['new-collection'],
      sourceGlobals: ['new-global'],
    })

    expect(violations).toContain('Collection "new-collection" is missing from CACHE_POLICY_CATALOG.')
    expect(violations).toContain('Global "new-global" is missing from CACHE_POLICY_CATALOG.')
  })

  it('accepts private and no-public-impact catalog classifications', () => {
    const catalog = [
      {
        boundary: 'private',
        cacheClass: 'private-live',
        collections: ['private-document'],
      },
      {
        boundary: 'public',
        cacheClass: 'critical-public',
        collections: ['no-public-impact-document'],
      },
    ] as const satisfies readonly CatalogCoverageEntry[]

    expect(
      getPolicyCoverageViolations({
        catalog,
        knownCollections: ['private-document', 'no-public-impact-document'],
        knownGlobals: [],
        sourceCollections: ['private-document', 'no-public-impact-document'],
        sourceGlobals: [],
      }),
    ).toEqual([])
  })

  it('fails when catalog vocabulary has no matching policy classification', () => {
    expect(
      getPolicyCoverageViolations({
        catalog: [{ collections: ['unknown-collection'] }],
        knownCollections: ['known-collection'],
        knownGlobals: [],
        sourceCollections: ['known-collection'],
        sourceGlobals: [],
      }),
    ).toContain('CACHE_POLICY_CATALOG references unknown collection "unknown-collection".')
  })

  it('blocks direct next/cache invalidation outside the executor boundary', () => {
    const violations = findNextCacheViolations({
      relativePath: 'src/hooks/revalidateSomething.ts',
      source: "import { revalidateTag } from 'next/cache'\nrevalidateTag('collection:pages')\n",
    })

    expect(violations).toContain(directInvalidationBoundaryMessage('src/hooks/revalidateSomething.ts'))
  })

  it('allows only the executor and exact media exception path to import direct invalidation', () => {
    const executorSource = {
      relativePath: EXECUTOR_RELATIVE_PATH,
      source:
        "import { revalidatePath, revalidateTag } from 'next/cache'\nrevalidateTag('collection:pages')\nrevalidatePath('/')\n",
    }
    const mediaExceptionSource = {
      relativePath: MEDIA_EXCEPTION_RELATIVE_PATH,
      source:
        "import { revalidatePath, revalidateTag } from 'next/cache.js'\nrevalidateTag('collection:pages')\nrevalidatePath('/')\n",
    }
    const similarPathSource = {
      relativePath: 'src/hooks/media/revalidateMediaConsumersCopy.ts',
      source: mediaExceptionSource.source,
    }

    expect(findNextCacheViolations(executorSource)).toEqual([])
    expect(findNextCacheViolations(mediaExceptionSource)).toEqual([])
    expect(findNextCacheViolations(similarPathSource)).toContain(
      directInvalidationBoundaryMessage(similarPathSource.relativePath),
    )
  })

  it('blocks namespace and default next/cache imports', () => {
    const namespaceViolations = findNextCacheViolations({
      relativePath: 'src/utilities/cacheNamespace.ts',
      source: "import * as cache from 'next/cache'\nvoid cache\n",
    })
    const defaultViolations = findNextCacheViolations({
      relativePath: 'src/utilities/cacheDefault.ts',
      source: "import cache from 'next/cache'\nvoid cache\n",
    })

    expect(namespaceViolations).toContain(
      'src/utilities/cacheNamespace.ts uses a namespace next/cache import, which is not allowed.',
    )
    expect(defaultViolations).toContain(
      'src/utilities/cacheDefault.ts uses a default next/cache import, which is not allowed.',
    )
  })

  it('blocks literal unstable_cache tags and accepts cachePolicy builder tags', () => {
    const literalViolations = findUnstableCacheTagViolations({
      relativePath: 'src/utilities/literalCache.ts',
      source:
        "import { unstable_cache } from 'next/cache'\nconst cached = unstable_cache(async () => null, [], { tags: ['pages-sitemap'] })\nvoid cached\n",
    })
    const builderViolations = findUnstableCacheTagViolations({
      relativePath: 'src/utilities/policyCache.ts',
      source:
        "import { unstable_cache } from 'next/cache'\nimport { buildCollectionTag } from '@/utilities/cachePolicy'\nconst cached = unstable_cache(async () => null, [], { tags: [buildCollectionTag('pages')] })\nvoid cached\n",
    })

    expect(literalViolations).toContain(
      'src/utilities/literalCache.ts uses a literal unstable_cache tag. Use cachePolicy builders instead.',
    )
    expect(builderViolations).toEqual([])
  })

  it('blocks Cache Components primitives with ADR guidance', () => {
    const violations = findCacheComponentsViolations({
      relativePath: 'next.config.ts',
      source: "'use cache'\nexport default { cacheComponents: true }\ncacheTag('pages')\ncacheLife('hours')\n",
    })

    expect(violations).toHaveLength(4)
    expect(violations.every((violation) => violation.includes('ADR 023'))).toBe(true)
  })

  it('keeps the repository inside the accepted cache architecture', () => {
    const runtimeSources = readSourcesUnder('src')
    const frameworkSources = [...runtimeSources, ...readNextConfigSources()]

    for (const source of runtimeSources) {
      expect(findNextCacheViolations(source), source.relativePath).toEqual([])
      expect(findUnstableCacheTagViolations(source), source.relativePath).toEqual([])
    }

    for (const source of frameworkSources) {
      expect(findCacheComponentsViolations(source), source.relativePath).toEqual([])
    }
  })
})
