// Storybook runtime shim.
//
// Some stories use `expect` from `@storybook/jest` in play functions.
// With this repo's Storybook + addon-vitest setup, importing the real
// `@storybook/jest` can crash the browser preview (Vitest/Jest internals like
// `customEqualityTesters` aren't initialized).
//
// We map `@storybook/jest` -> this file via a Vite alias in `.storybook/main.ts`.
// This is a minimal assertion helper (enough for our stories) and intentionally
// avoids Vitest/Jest globals.

type ExpectOptions = {
  negate?: boolean
}

type MatcherResult = {
  pass: boolean
  message: string
}

function format(value: unknown): string {
  try {
    if (value instanceof Element) return `<${value.tagName.toLowerCase()}>`
    if (typeof value === 'string') return JSON.stringify(value)
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function assertResult(result: MatcherResult, opts: ExpectOptions) {
  const pass = opts.negate ? !result.pass : result.pass
  if (!pass) {
    throw new Error(opts.negate ? `Expected NOT: ${result.message}` : `Expected: ${result.message}`)
  }
}

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && value instanceof Element
}

function isHTMLElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null && value instanceof HTMLElement
}

function toBeInTheDocument(actual: unknown): MatcherResult {
  if (!isElement(actual)) {
    return { pass: false, message: `${format(actual)} to be an Element in the document` }
  }
  return { pass: actual.isConnected === true, message: `${format(actual)} to be in the document` }
}

function toHaveAttribute(actual: unknown, name: string, expected?: string): MatcherResult {
  if (!isElement(actual)) {
    return { pass: false, message: `${format(actual)} to have attribute ${name}` }
  }
  const has = actual.hasAttribute(name)
  if (!has) return { pass: false, message: `${format(actual)} to have attribute ${name}` }
  if (expected === undefined) return { pass: true, message: `${format(actual)} to have attribute ${name}` }

  const actualValue = actual.getAttribute(name)
  return {
    pass: actualValue === expected,
    message: `${format(actual)} to have attribute ${name}=${format(expected)} (got ${format(actualValue)})`,
  }
}

function toBeDisabled(actual: unknown): MatcherResult {
  if (!isHTMLElement(actual)) {
    return { pass: false, message: `${format(actual)} to be a disabled HTMLElement` }
  }
  return {
    pass: actual.hasAttribute('disabled') || (actual as unknown as { disabled?: boolean }).disabled === true,
    message: `${format(actual)} to be disabled`,
  }
}

function toBeEnabled(actual: unknown): MatcherResult {
  if (!isHTMLElement(actual)) {
    return { pass: false, message: `${format(actual)} to be an enabled HTMLElement` }
  }
  const disabled = actual.hasAttribute('disabled') || (actual as unknown as { disabled?: boolean }).disabled === true
  return { pass: !disabled, message: `${format(actual)} to be enabled` }
}

function toEqual(actual: unknown, expected: unknown): MatcherResult {
  const pass = Object.is(actual, expected)
  return { pass, message: `${format(actual)} to equal ${format(expected)}` }
}

type ExpectApi = {
  not: ExpectApi
  toBeInTheDocument: () => void
  toHaveAttribute: (name: string, expected?: string) => void
  toBeDisabled: () => void
  toBeEnabled: () => void
  toEqual: (expected: unknown) => void
}

function createExpect(actual: unknown, opts: ExpectOptions): ExpectApi {
  const api: ExpectApi = {
    not: undefined as unknown as ExpectApi,
    toBeInTheDocument: () => assertResult(toBeInTheDocument(actual), opts),
    toHaveAttribute: (name, expected) => assertResult(toHaveAttribute(actual, name, expected), opts),
    toBeDisabled: () => assertResult(toBeDisabled(actual), opts),
    toBeEnabled: () => assertResult(toBeEnabled(actual), opts),
    toEqual: (expected) => assertResult(toEqual(actual, expected), opts),
  }

  api.not = createExpect(actual, { negate: !opts.negate })
  return api
}

export function expect(actual: unknown): ExpectApi {
  return createExpect(actual, { negate: false })
}
