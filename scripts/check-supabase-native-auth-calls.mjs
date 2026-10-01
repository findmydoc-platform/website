import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const nativeMethods = new Set(['signUp', 'resetPasswordForEmail', 'inviteUserByEmail'])
const flowStates = new Set(['unreplaced', 'replaced', 'excluded'])

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = propertyName(node.left)
    const right = propertyName(node.right)
    if (left !== undefined && right !== undefined) return left + right
  }
  return undefined
}

function propertyStates(states, property) {
  return new Set(
    [...states].map((state) => {
      if (property === 'auth') return 'auth'
      if (state === 'auth' && property === 'admin') return 'auth-admin'
      if ((state === 'auth' || state === 'auth-admin') && (nativeMethods.has(property) || property === undefined)) {
        return `native:${property ?? '<computed>'}`
      }
      return 'other'
    }),
  )
}

/** Bind only this file's lexical identifiers. No imports, helper calls, or module graph are resolved. */
function localAliasStates(file) {
  const options = { noLib: true, noResolve: true }
  const host = ts.createCompilerHost(options)
  host.getSourceFile = (name) => (name === file.fileName ? file : undefined)
  const checker = ts.createProgram([file.fileName], options, host).getTypeChecker()
  const aliases = new Map()
  const bindings = []
  const bind = (name, expression, properties = []) => {
    if (ts.isIdentifier(name)) bindings.push({ symbol: checker.getSymbolAtLocation(name), expression, properties })
    else if (ts.isObjectBindingPattern(name)) {
      for (const element of name.elements) {
        bind(
          element.name,
          expression,
          element.dotDotDotToken ? properties : [...properties, propertyName(element.propertyName ?? element.name)],
        )
      }
    }
  }
  const collect = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) && node.initializer) bind(node.name, node.initializer)
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      bind(node.left, node.right)
    }
    ts.forEachChild(node, collect)
  }
  collect(file)

  const states = (node) => {
    if (ts.isIdentifier(node)) return aliases.get(checker.getSymbolAtLocation(node)) ?? new Set(['other'])
    if (ts.isPropertyAccessExpression(node)) return propertyStates(states(node.expression), node.name.text)
    if (ts.isElementAccessExpression(node)) {
      return propertyStates(
        states(node.expression),
        ts.isIdentifier(node.argumentExpression) ? undefined : propertyName(node.argumentExpression),
      )
    }
    if (ts.isConditionalExpression(node)) return new Set([...states(node.whenTrue), ...states(node.whenFalse)])
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'bind'
    ) {
      return states(node.expression.expression)
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))
      return states(node.expression)
    return new Set(['other'])
  }
  let changed
  // Keep every possible local assignment. The finite receiver/method states converge even for cyclic aliases.
  do {
    changed = false
    for (const { symbol, expression, properties } of bindings) {
      if (!symbol) continue
      const possible = properties.reduce(propertyStates, states(expression))
      const previous = aliases.get(symbol) ?? new Set()
      for (const state of possible) {
        if (!previous.has(state)) {
          previous.add(state)
          changed = true
        }
      }
      aliases.set(symbol, previous)
    }
  } while (changed)
  return states
}

function functionScopes(node) {
  const scopes = []
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) scopes.push(current.name.text)
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      scopes.push(current.parent.name.text)
    }
  }
  return scopes.length ? scopes : ['<module>']
}

/** Inspect SDK-shaped Auth access, including local aliases and destructured method references. */
export function findNativeAuthCalls(path, source) {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  if (file.parseDiagnostics.length) return { ok: false, issues: [{ code: 'unparseable-source', path }] }
  const states = localAliasStates(file)
  const calls = []
  const scopes = new Set(['<module>'])
  const record = (node, possible) => {
    for (const state of possible) {
      if (!state.startsWith('native:')) continue
      const method = state.slice('native:'.length)
      const scopes = functionScopes(node)
      calls.push({ path, scope: scopes[0], enclosingScopes: scopes, method })
    }
  }

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) scopes.add(node.name.text)
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    )
      scopes.add(node.name.text)
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) record(node, states(node.name))
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) record(node, states(node))
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) record(node, states(node.expression))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return { ok: true, calls, scopes: [...scopes] }
}

function callKey(call) {
  return `${call.path}:${call.scope}:${call.method}`
}

function validInventory(inventory) {
  if (!inventory || inventory.version !== 1 || !Array.isArray(inventory.flows) || !Array.isArray(inventory.calls))
    return false
  const flows = new Map()
  const protectedScopes = new Set()
  for (const flow of inventory.flows) {
    if (
      !flow ||
      typeof flow.id !== 'string' ||
      flows.has(flow.id) ||
      !flowStates.has(flow.status) ||
      (flow.status === 'excluded' ? flow.issue !== null : flow.issue !== 1734) ||
      !Array.isArray(flow.scopes) ||
      flow.scopes.length === 0
    )
      return false
    for (const scope of flow.scopes) {
      if (
        !scope ||
        !/^src\/[\w/().-]+\.[cm]?[jt]sx?$/u.test(scope.path) ||
        typeof scope.scope !== 'string' ||
        !scope.scope ||
        protectedScopes.has(`${scope.path}:${scope.scope}`)
      )
        return false
      protectedScopes.add(`${scope.path}:${scope.scope}`)
    }
    flows.set(flow.id, flow)
  }
  const keys = new Set()
  for (const call of inventory.calls) {
    if (
      !call ||
      !flows.has(call.flow) ||
      !/^src\/[\w/().-]+\.[cm]?[jt]sx?$/u.test(call.path) ||
      typeof call.scope !== 'string' ||
      !nativeMethods.has(call.method) ||
      !Number.isSafeInteger(call.count) ||
      call.count < 1 ||
      keys.has(callKey(call)) ||
      !flows.get(call.flow).scopes.some((scope) => scope.path === call.path && scope.scope === call.scope)
    )
      return false
    keys.add(callKey(call))
  }
  return flows.size > 0
}

/** Block native Auth APIs only in declared #1734 scopes after their product flow is replaced. */
export function checkNativeAuthCalls(sources, inventory) {
  if (!validInventory(inventory)) return { ok: false, issues: [{ code: 'invalid-native-call-inventory' }] }
  const issues = []
  const protectedScopes = inventory.flows.filter((flow) => flow.status === 'replaced').flatMap((flow) => flow.scopes)
  const seenScopes = new Set()
  for (const { path, source } of sources) {
    const relevant = protectedScopes.filter((scope) => scope.path === path)
    if (!relevant.length) continue
    const result = findNativeAuthCalls(path, source)
    if (!result.ok) issues.push(...result.issues)
    else {
      for (const scope of result.scopes) seenScopes.add(`${path}:${scope}`)
      for (const call of result.calls) {
        const protectedScope = relevant.find((scope) => call.enclosingScopes.includes(scope.scope))
        if (protectedScope) {
          issues.push({
            code: call.method === '<computed>' ? 'unverifiable-auth-api' : 'prohibited-native-api',
            path,
            scope: protectedScope.scope,
            method: call.method,
          })
        }
      }
    }
  }
  for (const scope of protectedScopes) {
    if (!seenScopes.has(`${scope.path}:${scope.scope}`)) issues.push({ code: 'missing-replaced-flow-scope', ...scope })
  }
  return { ok: issues.length === 0, issues }
}

async function productiveSources(root, directory = resolve(root, 'src')) {
  const sources = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name)
    const path = relative(root, absolute).replaceAll('\\', '/')
    if (entry.isDirectory() && !['src/stories', 'src/migrations'].includes(path)) {
      sources.push(...(await productiveSources(root, absolute)))
    } else if (
      entry.isFile() &&
      /\.[cm]?[jt]sx?$/u.test(entry.name) &&
      !/\.(?:stories|d)\.[cm]?[jt]sx?$/u.test(entry.name)
    ) {
      sources.push({ path, source: await readFile(absolute, 'utf8') })
    }
  }
  return sources
}

export async function checkNativeAuthRepository(root = process.cwd()) {
  try {
    const inventory = JSON.parse(await readFile(resolve(root, 'supabase/native-auth-call-inventory.json'), 'utf8'))
    return checkNativeAuthCalls(await productiveSources(root), inventory)
  } catch {
    return { ok: false, issues: [{ code: 'unreadable-native-call-inputs' }] }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkNativeAuthRepository()
  if (result.ok) console.log('Supabase native Auth checks pass for declared replaced #1734 flows.')
  else
    for (const issue of result.issues) {
      console.error(
        `Supabase native Auth check failed: ${issue.code}${issue.path ? ` (${issue.path}, ${issue.scope ?? ''}, ${issue.method ?? ''})` : ''}.`,
      )
    }
  process.exitCode = result.ok ? 0 : 1
}
