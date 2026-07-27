import { describe, expect, it } from 'vitest'

import {
  flattenLexicalBiography,
  plainTextBiographyToLexical,
} from '@/migrations/20260727_145822_doctor_biography_plain_text'

describe('doctor biography migration', () => {
  it('flattens formatted Lexical paragraphs while preserving paragraph and line breaks', () => {
    const biography = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'First ', format: 1 },
              { type: 'text', text: 'paragraph.' },
              { type: 'linebreak' },
              { type: 'text', text: 'Second line.' },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Second paragraph.' }],
          },
        ],
      },
    }

    expect(flattenLexicalBiography(biography)).toBe('First paragraph.\nSecond line.\n\nSecond paragraph.')
  })

  it('returns null for empty or malformed rich text', () => {
    expect(flattenLexicalBiography(null)).toBeNull()
    expect(flattenLexicalBiography({ root: { children: [] } })).toBeNull()
  })

  it('rebuilds a valid minimal Lexical document for rollback', () => {
    const lexical = plainTextBiographyToLexical('First line.\nSecond line.\n\nSecond paragraph.')

    expect(lexical).toMatchObject({
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'First line.' },
              { type: 'linebreak' },
              { type: 'text', text: 'Second line.' },
            ],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: 'Second paragraph.' }],
          },
        ],
      },
    })
  })
})
