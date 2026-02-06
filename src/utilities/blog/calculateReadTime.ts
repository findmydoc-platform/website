import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Calculate estimated read time from Lexical content
 * Assumes average reading speed of 200 words per minute
 * @param content - Lexical SerializedEditorState
 * @returns Formatted read time string (e.g., "8 Min. Lesezeit")
 */
export function calculateReadTime(content: SerializedEditorState | undefined | null): string {
  if (!content) return ''

  try {
    // Extract text from Lexical nodes recursively
    const extractText = (node: unknown): string => {
      if (!node || typeof node !== 'object') return ''

      const nodeObj = node as Record<string, unknown>

      // Handle text nodes
      if (nodeObj.type === 'text' && typeof nodeObj.text === 'string') {
        return nodeObj.text
      }

      // Handle nodes with children
      if (Array.isArray(nodeObj.children)) {
        return nodeObj.children.map(extractText).join(' ')
      }

      // Handle root node
      if (nodeObj.root && typeof nodeObj.root === 'object') {
        return extractText(nodeObj.root)
      }

      return ''
    }

    const text = extractText(content)
    const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length

    // Average reading speed: 200 words per minute
    const minutes = Math.ceil(wordCount / 200)

    if (minutes < 1) return '< 1 Min. Lesezeit'

    return `${minutes} Min. Lesezeit`
  } catch (error) {
    console.error('Error calculating read time:', error)
    return ''
  }
}
