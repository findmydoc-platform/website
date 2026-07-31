type RichTextRecord = Record<string, unknown>

const isRecord = (value: unknown): value is RichTextRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const textFromNode = (node: unknown): string => {
  if (!isRecord(node)) return ''
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''

  return node.children.map(textFromNode).join('')
}

export const richTextToPlainText = (value: unknown): string => {
  if (!isRecord(value) || !isRecord(value.root) || !Array.isArray(value.root.children)) return ''

  return value.root.children.map(textFromNode).join('\n\n')
}

const buildTextNode = (text: string) => ({
  detail: 0,
  format: 0,
  mode: 'normal' as const,
  style: '',
  text,
  type: 'text' as const,
  version: 1,
})

const buildParagraph = (text: string) => ({
  children: [buildTextNode(text)],
  direction: 'ltr' as const,
  format: '',
  indent: 0,
  type: 'paragraph' as const,
  version: 1,
})

export const canonicalizeDescriptionText = (value: string): RichTextRecord | null => {
  const normalized = value.replace(/\r\n?/gu, '\n')
  if (normalized.length === 0) return null

  return {
    root: {
      children: normalized.split(/\n[^\S\n]*\n/gu).map(buildParagraph),
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

export const preserveOrCanonicalizeDescription = ({
  existing,
  nextText,
}: {
  existing: unknown
  nextText: string
}): unknown =>
  richTextToPlainText(existing) === nextText ? structuredClone(existing) : canonicalizeDescriptionText(nextText)
