import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const groups = {
  location: {
    files: ['countries.lifecycle.test.ts'],
    cases: 5,
    roots: ['countries', 'platformStaff', 'clinicStaff', 'patients'],
  },
  gallery: {
    files: [
      'clinicGalleryEntries.lifecycle.test.ts',
      'clinicGalleryEntries.validation.test.ts',
      'clinicGalleryMedia.lifecycle.test.ts',
    ],
    cases: 19,
    roots: [
      'clinicGalleryEntries',
      'clinicGalleryMedia',
      'clinics',
      'clinicStaff',
      'platformStaff',
      'cities',
      'doctors',
    ],
  },
}
export const scenarios = {
  country: ['src/collections/Countries.ts'],
  gallery: ['src/collections/ClinicGalleryEntries/hooks/beforeChangeClinicGalleryEntry.ts'],
}
const posix = (value) => value.split(path.sep).join('/')
const source = (filename) =>
  ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
const visit = (node, fn) => {
  fn(node)
  ts.forEachChild(node, (child) => visit(child, fn))
}
const resolveFile = (base) =>
  [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.tsx`].find(
    (filename) => fs.existsSync(filename) && fs.statSync(filename).isFile(),
  )

export function runtimeGraph(entries, root = process.cwd(), configBoundary = false) {
  const queue = [...entries],
    files = new Set(),
    unresolved = new Set()
  while (queue.length) {
    const filename = queue.shift()
    if (files.has(filename)) continue
    files.add(filename)
    const tree = source(path.join(root, filename))
    const imports = []
    visit(tree, (node) => {
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) {
        if (
          node.importClause?.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          !node.importClause.name &&
          node.importClause.namedBindings.elements.every((item) => item.isTypeOnly)
        )
          return
        imports.push(node.moduleSpecifier.text)
      }
      if (
        ts.isExportDeclaration(node) &&
        !node.isTypeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        imports.push(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text)
        else unresolved.add(`${filename}:computed-import`)
      }
    })
    for (const specifier of imports) {
      const base =
        specifier === '@payload-config'
          ? path.join(root, 'src/payload.config.ts')
          : specifier.startsWith('@/')
            ? path.join(root, 'src', specifier.slice(2))
            : specifier.startsWith('.')
              ? path.resolve(root, path.dirname(filename), specifier)
              : null
      if (!base) continue
      if (configBoundary && path.resolve(base) === path.join(root, 'src/payload.config.ts')) continue
      const resolved = resolveFile(base)
      if (resolved && configBoundary && resolved === path.join(root, 'src/payload.config.ts')) continue
      if (resolved) queue.push(posix(path.relative(root, resolved)))
      else unresolved.add(`${filename}:${specifier}`)
    }
  }
  return { files: [...files].sort(), unresolved: [...unresolved].sort() }
}

export function collectionInventory(root = process.cwd()) {
  const tree = source(path.join(root, 'src/payload.config.ts'))
  const inventory = {}
  for (const node of tree.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      !node.moduleSpecifier.text.startsWith('./collections/')
    )
      continue
    const filename = resolveFile(path.resolve(root, 'src', node.moduleSpecifier.text))
    if (!filename || !node.importClause?.namedBindings || !ts.isNamedImports(node.importClause.namedBindings)) continue
    const definitions = source(filename)
    let slug
    const symbol = node.importClause.namedBindings.elements[0].name.text
    visit(definitions, (item) => {
      if (
        !ts.isVariableDeclaration(item) ||
        item.name.getText(definitions) !== symbol ||
        !item.initializer ||
        !ts.isObjectLiteralExpression(item.initializer)
      )
        return
      const field = item.initializer.properties.find(
        (property) => ts.isPropertyAssignment(property) && property.name.getText(definitions) === 'slug',
      )
      if (field && ts.isStringLiteral(field.initializer)) slug = field.initializer.text
    })
    if (slug)
      inventory[slug] = {
        symbol: node.importClause.namedBindings.elements[0].name.text,
        path: posix(path.relative(root, filename)),
      }
  }
  return inventory
}

export function inventoryGroups(root = process.cwd()) {
  const inventory = collectionInventory(root)
  const common = [
    'tests/integration-domain-poc/shared/createTestConfig.ts',
    'src/plugins/index.ts',
    'src/auth/actions/protocol/storage.ts',
    'src/features/transactionalEmail/eventSchema.ts',
    'src/fields/defaultLexical.ts',
    'src/features/databaseAvailability/index.ts',
  ].filter((filename) => fs.existsSync(path.join(root, filename)))
  const result = {}
  for (const [name, group] of Object.entries(groups)) {
    // Preserve relationship targets, literal Payload calls, and all configured plugin targets.
    const selected = new Set([
      ...group.roots,
      'pages',
      'posts',
      'categories',
      'accreditation',
      'medical-specialties',
      'treatments',
      'tags',
      'cities',
      'clinictreatments',
      'doctortreatments',
      'doctorspecialties',
      'reviews',
      'doctorMedia',
      'authActions',
      'recoveryRequestEvents',
      'transactionalEmailOutbox',
      'transactionalEmailEvents',
      'transactionalEmailSuppressions',
    ])
    let graph
    while (true) {
      graph = runtimeGraph([...common, ...[...selected].map((slug) => inventory[slug].path)], root, true)
      const refs = new Set(selected)
      for (const filename of graph.files)
        visit(source(path.join(root, filename)), (node) => {
          if (!ts.isPropertyAssignment(node) || !['collection', 'relationTo'].includes(node.name.getText())) return
          const values = ts.isArrayLiteralExpression(node.initializer) ? node.initializer.elements : [node.initializer]
          for (const value of values)
            if (ts.isStringLiteral(value) && Object.hasOwn(inventory, value.text)) refs.add(value.text)
        })
      if (refs.size === selected.size) break
      for (const slug of refs) selected.add(slug)
    }
    if (graph.files.includes('src/payload.config.ts'))
      throw new Error(`Full application config is imported by ${name}; isolation is not valid.`)
    result[name] = {
      collections: [...selected].sort(),
      dependencies: graph.files,
      unresolved: graph.unresolved,
      fullCollectionCount: Object.keys(inventory).length,
    }
  }
  return { inventory, groups: result }
}

export function selectGroups(changes, manifests, staticFiles = [], classificationFailed = false) {
  const names = Object.keys(groups),
    reasons = []
  if (classificationFailed || !Array.isArray(changes))
    return { groups: names, reasons: ['classification-failed'], fallback: true }
  const selected = new Set()
  for (const change of changes) {
    if (typeof change !== 'string' && (!change || typeof change.path !== 'string'))
      return { groups: names, reasons: ['invalid-change'], fallback: true }
    for (const filename of typeof change === 'string'
      ? [change]
      : [change?.path, change?.previousPath].filter(Boolean)) {
      if (
        typeof filename !== 'string' ||
        filename.startsWith('/') ||
        filename.includes('..') ||
        filename.includes('\\')
      )
        return { groups: names, reasons: ['invalid-path'], fallback: true }
      if (/^(docs\/|README(?:\.[^/]+)?$)/.test(filename) && /\.md$/.test(filename)) {
        reasons.push(`${filename}:documentation`)
        continue
      }
      let matched = false
      for (const name of names) {
        const tests = groups[name].files.map((file) => `tests/integration-domain-poc/${name}/${file}`)
        if (
          manifests[name]?.dependencies.includes(filename) ||
          tests.includes(filename) ||
          staticFiles.some((file) => tests.includes(file) && filename.startsWith('src/'))
        ) {
          selected.add(name)
          matched = true
          reasons.push(`${filename}:${name}`)
        }
      }
      if (!matched) return { groups: names, reasons: [...reasons, `${filename}:unknown-impact`], fallback: true }
    }
  }
  if (names.some((name) => manifests[name]?.unresolved?.length))
    return { groups: names, reasons: [...reasons, 'unresolved-imports'], fallback: true }
  return { groups: names.filter((name) => selected.has(name)), reasons, fallback: false }
}

export function validateMeasurement(receipt) {
  if (
    !receipt ||
    receipt.status !== 'passed' ||
    receipt.cleanup !== 'passed' ||
    !Array.isArray(receipt.groups) ||
    !receipt.groups.length
  )
    throw new Error('Incomplete or unsuccessful measurement.')
  if (new Set(receipt.groups.map((group) => group.name)).size !== receipt.groups.length)
    throw new Error('Duplicate measured group.')
  for (const group of receipt.groups) {
    const expected = groups[group.name]
    if (
      !expected ||
      !group.report ||
      group.report.unhandledErrors !== 0 ||
      group.report.modules.length !== expected.files.length
    )
      throw new Error('Invalid test workload.')
    for (const file of expected.files) {
      const measuredModule = group.report.modules.find((item) => item.filename.endsWith(`/${file}`))
      if (!measuredModule || measuredModule.tests.some((test) => test.state !== 'passed' || test.retries !== 0))
        throw new Error('Failed, skipped or retried test case.')
    }
    if (group.report.modules.reduce((sum, module) => sum + module.tests.length, 0) !== expected.cases)
      throw new Error('Test case count changed.')
  }
  return receipt
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(inventoryGroups(), null, 2))
