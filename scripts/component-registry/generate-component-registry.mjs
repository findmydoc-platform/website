import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STORIES_ROOT = path.resolve(ROOT, 'src/stories')
const GENERATED_PATH = path.resolve(ROOT, 'docs/frontend/component-registry.generated.json')
const OVERRIDES_PATH = path.resolve(ROOT, 'docs/frontend/component-registry.overrides.json')
const MERGED_PATH = path.resolve(ROOT, 'docs/frontend/component-registry.json')
const MARKDOWN_PATH = path.resolve(ROOT, 'docs/frontend/component-registry.md')

const STORY_FILE_PATTERN = /\.stories\.(ts|tsx|js|jsx)$/

const args = new Set(process.argv.slice(2))
const checkMode = args.has('--check')

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

    if (STORY_FILE_PATTERN.test(entry.name)) files.push(fullPath)
  }

  return files
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
      if (char === '\\') {
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

const extractComponentPath = (content) => {
  const importMatch = content.match(/from\s+['"]@\/components\/([^'"\n]+)['"]/)
  if (!importMatch) return null
  return `src/components/${importMatch[1]}`
}

const toEntryId = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const parseStoryEntry = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8')
  const metaBlock = extractMetaBlock(content)
  if (!metaBlock) return null

  const titleMatch = metaBlock.match(/title:\s*['"`]([^'"`]+)['"`]/)
  if (!titleMatch) return null

  const title = titleMatch[1]
  const tags = extractTags(metaBlock)

  const domainTag = tags.find((tag) => tag.startsWith('domain:'))
  const layerTag = tags.find((tag) => tag.startsWith('layer:'))
  const statusTag = tags.find((tag) => tag.startsWith('status:'))

  const usedIn = tags.filter((tag) => tag.startsWith('used-in:'))

  const domain = domainTag ? domainTag.slice('domain:'.length) : 'unknown'
  const layer = layerTag ? layerTag.slice('layer:'.length) : 'unknown'
  const status = statusTag ? statusTag.slice('status:'.length) : 'stable'

  return {
    id: toEntryId(title),
    title,
    domain,
    layer,
    status,
    storyPath: toPosix(path.relative(ROOT, filePath)),
    componentPath: extractComponentPath(content),
    usedIn,
    replacement: null,
  }
}

const loadOverrides = async () => {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, 'utf8')
    const parsed = JSON.parse(raw)

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Overrides file must be a JSON object with an "entries" map.')
    }

    if (!parsed.entries || typeof parsed.entries !== 'object' || Array.isArray(parsed.entries)) {
      throw new Error('Overrides file must contain an "entries" object map keyed by entry id.')
    }

    return parsed
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { entries: {} }
    }
    throw error
  }
}

const mergeEntries = (generatedEntries, overrides) => {
  const generatedMap = new Map(generatedEntries.map((entry) => [entry.id, entry]))

  for (const overrideId of Object.keys(overrides.entries)) {
    if (!generatedMap.has(overrideId)) {
      throw new Error(`Override references unknown id: ${overrideId}`)
    }
  }

  const merged = generatedEntries.map((entry) => {
    const override = overrides.entries[entry.id] ?? {}
    return {
      ...entry,
      ...override,
      usedIn: Array.isArray(override.usedIn) ? override.usedIn : entry.usedIn,
      replacement: override.replacement ?? entry.replacement,
    }
  })

  return merged.sort((a, b) => a.title.localeCompare(b.title))
}

const buildMarkdown = (entries) => {
  const lines = []
  lines.push('# Component Registry')
  lines.push('')
  lines.push('Generated from Storybook metadata. Do not edit manually; update stories and overrides instead.')
  lines.push('')
  lines.push('| Title | Domain | Layer | Status | Used In | Story | Component | Replacement |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')

  for (const entry of entries) {
    const usedIn = entry.usedIn?.length ? entry.usedIn.join('<br>') : ''
    const replacement = entry.replacement ?? ''
    const componentPath = entry.componentPath ?? ''

    lines.push(
      `| ${entry.title} | ${entry.domain} | ${entry.layer} | ${entry.status} | ${usedIn} | ${entry.storyPath} | ${componentPath} | ${replacement} |`,
    )
  }

  lines.push('')
  lines.push('## Maintenance')
  lines.push('')
  lines.push('- Update story metadata when adding or changing stories.')
  lines.push('- Use `docs/frontend/component-registry.overrides.json` for manual lifecycle and replacement overrides.')

  return `${lines.join('\n')}\n`
}

const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`

const fileContentOrEmpty = async (filePath) => {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return ''
    throw error
  }
}

const main = async () => {
  const files = await walk(STORIES_ROOT)
  const parsed = await Promise.all(files.map((file) => parseStoryEntry(file)))
  const generatedEntries = parsed.filter((entry) => entry !== null).sort((a, b) => a.title.localeCompare(b.title))

  const overrides = await loadOverrides()
  const mergedEntries = mergeEntries(generatedEntries, overrides)

  const generatedContent = stableJson(generatedEntries)
  const mergedContent = stableJson(mergedEntries)
  const markdownContent = buildMarkdown(mergedEntries)

  if (checkMode) {
    const [existingGenerated, existingMerged, existingMarkdown] = await Promise.all([
      fileContentOrEmpty(GENERATED_PATH),
      fileContentOrEmpty(MERGED_PATH),
      fileContentOrEmpty(MARKDOWN_PATH),
    ])

    const mismatches = []
    if (existingGenerated !== generatedContent) mismatches.push(toPosix(path.relative(ROOT, GENERATED_PATH)))
    if (existingMerged !== mergedContent) mismatches.push(toPosix(path.relative(ROOT, MERGED_PATH)))
    if (existingMarkdown !== markdownContent) mismatches.push(toPosix(path.relative(ROOT, MARKDOWN_PATH)))

    if (mismatches.length > 0) {
      console.error('Component registry artifacts are out of date:')
      mismatches.forEach((item) => console.error(`- ${item}`))
      console.error('Run: pnpm registry:generate')
      process.exit(1)
    }

    console.log(`Component registry check passed (${mergedEntries.length} entries).`)
    return
  }

  await Promise.all([
    fs.writeFile(GENERATED_PATH, generatedContent, 'utf8'),
    fs.writeFile(MERGED_PATH, mergedContent, 'utf8'),
    fs.writeFile(MARKDOWN_PATH, markdownContent, 'utf8'),
  ])

  console.log(`Component registry generated (${mergedEntries.length} entries).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
