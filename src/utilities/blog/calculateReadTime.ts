import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Calculate estimated read time from Lexical content
 * Assumes average reading speed of 200 words per minute
 * @param content - Lexical SerializedEditorState
 * @returns Whole reading minutes, zero for under a minute, or null for empty content
 */
export function estimateReadMinutes(content: SerializedEditorState | undefined | null): number | null {
  if (!content) return null

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

    if (wordCount === 0) return null

    // Average reading speed: 200 words per minute
    return wordCount < 200 ? 0 : Math.ceil(wordCount / 200)
  } catch (error) {
    console.error('Error calculating read time:', error)
    return null
  }
}

export function calculateReadTime(content: SerializedEditorState | undefined | null): string {
  const minutes = estimateReadMinutes(content)
  if (minutes === null) return ''
  return minutes === 0 ? '< 1 min read' : `${minutes} min read`
}
