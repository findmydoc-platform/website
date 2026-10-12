import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type AstNode = { type: string; value?: string; nodes?: AstNode[] }
type Braces = {
  parse: (input: string) => AstNode
  compile: (input: string | AstNode) => string
  expand: (input: string | AstNode) => string[]
  stringify: (input: string | AstNode) => string
}

const require = createRequire(import.meta.url)
const nextLintRequire = createRequire(require.resolve('@next/eslint-plugin-next'))
const globRequire = createRequire(nextLintRequire.resolve('fast-glob'))
const micromatchRequire = createRequire(globRequire.resolve('micromatch'))
const payloadNextRequire = createRequire(
  realpathSync(new URL('../../../node_modules/@payloadcms/next/package.json', import.meta.url)),
)
const sassRequire = createRequire(payloadNextRequire.resolve('sass'))
const chokidarRequire = createRequire(sassRequire.resolve('chokidar'))

describe.each([
  { name: 'Next.js lint globs', braces: micromatchRequire('braces') as Braces },
  { name: 'Payload Sass watcher', braces: chokidarRequire('braces') as Braces },
])('braces security patch used by $name', ({ braces }) => {
  const deepPatterns = [
    '{'.repeat(4000) + 'a,b' + '}'.repeat(4000),
    '('.repeat(4000) + 'a' + ')'.repeat(4000),
    '{('.repeat(2000) + 'a,b' + ')}'.repeat(2000),
    '{'.repeat(4000) + 'a,b',
  ]

  it.each(['parse', 'compile', 'expand', 'stringify'] as const)(
    '%s rejects deep patterns before recursive traversal',
    (operation) => {
      for (const pattern of deepPatterns) {
        expect(() => braces[operation](pattern)).toThrow(SyntaxError)
        expect(() => braces[operation](pattern)).toThrow(/safe depth/)
      }
    },
  )

  it.each(['compile', 'expand', 'stringify'] as const)('%s rejects deep and cyclic supplied ASTs', (operation) => {
    let deep: AstNode = { type: 'text', value: 'a' }
    for (let i = 0; i < 12000; i++) deep = { type: 'root', nodes: [deep] }
    expect(() => braces[operation](deep)).toThrow(/safe depth/)

    const cycle: AstNode = { type: 'root', nodes: [] }
    cycle.nodes!.push(cycle)
    expect(() => braces[operation](cycle)).toThrow(/acyclic/)
  })

  it('preserves normal ranges, nested alternatives, and literal delimiters', () => {
    expect(braces.expand('a/{1..3}/{x,y}')).toEqual(['a/1/x', 'a/1/y', 'a/2/x', 'a/2/y', 'a/3/x', 'a/3/y'])
    expect(braces.expand('a/{b,{c,d}}')).toEqual(['a/b', 'a/c', 'a/d'])
    expect(braces.compile('a/{b,c}')).toBe('a/(b|c)')
    expect(braces.stringify('a/{b,c}')).toBe('a/{b,c}')
    expect(() => braces.compile('{'.repeat(64) + 'a,b' + '}'.repeat(64))).not.toThrow()
    expect(braces.stringify('"' + '{'.repeat(4000) + '"')).toBe('{'.repeat(4000))
    expect(braces.stringify('\\{'.repeat(2000))).toBe('{'.repeat(2000))
  })

  it('allows shared acyclic nodes without treating them as cycles', () => {
    const leaf: AstNode = { type: 'text', value: 'a' }
    const ast: AstNode = { type: 'root', nodes: [leaf, leaf] }
    expect(braces.stringify(ast)).toBe('aa')
    expect(braces.compile(ast)).toBe('aa')
  })
})
