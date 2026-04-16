import { describe, expect, it } from 'vitest'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { calculateReadTime } from '@/utilities/blog/calculateReadTime'

type LexicalState = {
  root: {
    type: 'root'
    children: Array<{ type: 'paragraph'; children: Array<{ type: 'text'; text: string }> }>
  }
}

const buildState = (text: string): LexicalState => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text }],
      },
    ],
  },
})

describe('calculateReadTime', () => {
  it('returns an empty string for empty lexical content', () => {
    expect(calculateReadTime(buildState('') as unknown as SerializedEditorState)).toBe('')
  })

  it('returns less than one minute for short content with words', () => {
    expect(calculateReadTime(buildState('A short post body') as unknown as SerializedEditorState)).toBe('< 1 min read')
  })
})
