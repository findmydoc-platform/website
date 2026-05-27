import { promises as fs } from 'node:fs'
import path from 'node:path'

const STORIES_ROOT = path.resolve(process.cwd(), 'src/stories')
const ALLOWED_LAYER_TAGS = new Set(['atom', 'molecule', 'organism', 'template', 'page'])
const ALLOWED_STATUS_TAGS = new Set(['stable', 'experimental', 'deprecated'])

const TITLE_PATTERNS = [
  /^Shared\/(Atoms|Molecules|Organisms|Templates|Pages)\/.+$/,
  /^Domain\/[A-Za-z][A-Za-z0-9-]*\/(Atoms|Molecules|Organisms|Templates|Pages)\/.+$/,
  /^Internal\/[A-Za-z][A-Za-z0-9-]*\/(Atoms|Molecules|Organisms|Templates|Pages)\/.+$/,
]

const STORY_FILE_PATTERN = /\.stories\.(ts|tsx|js|jsx)$/
const MDX_DOC_FILE_PATTERN = /\.mdx$/

const toPosix = (value) => value.split(path.sep).join('/')

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }

    if (STORY_FILE_PATTERN.test(entry.name) || MDX_DOC_FILE_PATTERN.test(entry.name)) files.push(fullPath)
  }

  return files
}

const validateTitle = (relativePath, title) => {
  const errors = []
  const titlePatternMatch = TITLE_PATTERNS.some((pattern) => pattern.test(title))
  if (!titlePatternMatch) {
    errors.push(
      `${relativePath}: Invalid title "${title}". Use Shared/<Layer>/..., Domain/<Domain>/<Layer>/..., or Internal/<Domain>/<Layer>/...`,
    )
  }

  return errors
}

const validateStoryTestAndMockImports = (relativePath, content) => {
  const errors = []

  if (content.match(/from\s+['"]@storybook\/test['"]|require\(\s*['"]@storybook\/test['"]\s*\)/)) {
    errors.push(`${relativePath}: Import Storybook test helpers from "storybook/test", not "@storybook/test".`)
  }

  if (content.match(/from\s+['"]vitest['"]|require\(\s*['"]vitest['"]\s*\)/)) {
    errors.push(`${relativePath}: Do not import "vitest" from story files; use "storybook/test" helpers.`)
  }

  if (content.match(/\bvi\.mock\s*\(/)) {
    errors.push(`${relativePath}: Do not call vi.mock from story files; centralize module mocks in .storybook/main.ts.`)
  }

  if (content.match(/\bsb\.mock\s*\(/)) {
    errors.push(`${relativePath}: Do not call sb.mock from story files; centralize module mocks in .storybook/main.ts.`)
  }

  return errors
}

const extractMetaBlock = (content) => {
  const start = content.indexOf('const meta')
  if (start === -1) return null

  const end = content.indexOf('export default meta', start)
  if (end === -1) return null

  return content.slice(start, end)
}

const extractTags = (metaBlock) => {
  const tagsLabelIndex = metaBlock.indexOf('tags:')
  if (tagsLabelIndex === -1) return []

  const arrayStart = metaBlock.indexOf('[', tagsLabelIndex)
  if (arrayStart === -1) return []

  let arrayEnd = -1
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = arrayStart; i < metaBlock.length; i += 1) {
    const char = metaBlock[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\\\') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '[') {
      depth += 1
      continue
    }

    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = i
        break
      }
    }
  }

  if (arrayEnd === -1) return []

  const tagBlock = metaBlock.slice(arrayStart + 1, arrayEnd)

  const tags = []
  const stringRegex = /['"`]([^'"`]+)['"`]/g
  for (const match of tagBlock.matchAll(stringRegex)) {
    tags.push(match[1])
  }

  return tags
}

const validateStory = (filePath, content) => {
  const errors = []
  const relativePath = toPosix(path.relative(process.cwd(), filePath))

  const metaBlock = extractMetaBlock(content)
  errors.push(...validateStoryTestAndMockImports(relativePath, content))

  if (!metaBlock) {
    errors.push(`${relativePath}: Could not locate a valid meta block.`)
    return errors
  }

  const titleMatch = metaBlock.match(/title:\s*['"`]([^'"`]+)['"`]/)
  if (!titleMatch) {
    errors.push(`${relativePath}: Missing meta.title.`)
    return errors
  }

  const title = titleMatch[1]
  errors.push(...validateTitle(relativePath, title))

  const tags = extractTags(metaBlock)
  if (!tags.includes('autodocs')) {
    errors.push(`${relativePath}: Missing required tag "autodocs".`)
  }

  const domainTag = tags.find((tag) => tag.startsWith('domain:'))
  if (!domainTag) errors.push(`${relativePath}: Missing required tag prefix "domain:".`)

  const layerTag = tags.find((tag) => tag.startsWith('layer:'))
  if (!layerTag) {
    errors.push(`${relativePath}: Missing required tag prefix "layer:".`)
  }

  const statusTag = tags.find((tag) => tag.startsWith('status:'))
  if (!statusTag) {
    errors.push(`${relativePath}: Missing required tag prefix "status:".`)
  }

  const layerValue = layerTag?.slice('layer:'.length)
  if (layerValue && !ALLOWED_LAYER_TAGS.has(layerValue)) {
    errors.push(
      `${relativePath}: Invalid layer tag value "${layerValue}". Allowed: ${Array.from(ALLOWED_LAYER_TAGS).join(', ')}.`,
    )
  }

  const statusValue = statusTag?.slice('status:'.length)
  if (statusValue && !ALLOWED_STATUS_TAGS.has(statusValue)) {
    errors.push(
      `${relativePath}: Invalid status tag value "${statusValue}". Allowed: ${Array.from(ALLOWED_STATUS_TAGS).join(', ')}.`,
    )
  }

  if (layerValue && ['organism', 'template', 'page'].includes(layerValue)) {
    const hasUsageTag = tags.some((tag) => {
      return tag.startsWith('used-in:block:') || tag.startsWith('used-in:route:') || tag === 'used-in:shared'
    })

    if (!hasUsageTag) {
      errors.push(
        `${relativePath}: layer:${layerValue} requires a usage tag (used-in:block:..., used-in:route:..., or used-in:shared).`,
      )
    }
  }

  return errors
}

const validateMdxDoc = (filePath, content) => {
  const errors = []
  const relativePath = toPosix(path.relative(process.cwd(), filePath))

  const titleMatch = content.match(/<Meta\s+[^>]*title=["']([^"']+)["'][^>]*\/?>/)
  if (!titleMatch) {
    errors.push(`${relativePath}: Missing <Meta title="...">.`)
    return errors
  }

  errors.push(...validateTitle(relativePath, titleMatch[1]))
  return errors
}

const main = async () => {
  const files = await walk(STORIES_ROOT)
  const errors = []
  let storyCount = 0
  let mdxCount = 0

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8')
    if (STORY_FILE_PATTERN.test(file)) {
      storyCount += 1
      errors.push(...validateStory(file, content))
      continue
    }

    if (MDX_DOC_FILE_PATTERN.test(file)) {
      mdxCount += 1
      errors.push(...validateMdxDoc(file, content))
    }
  }

  if (errors.length > 0) {
    console.error('Story governance validation failed:\n')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(`Story governance validation passed for ${storyCount} story files and ${mdxCount} MDX docs.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
