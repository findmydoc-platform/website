import { describe, expect, it } from 'vitest'

import {
  canonicalizeDescriptionText,
  preserveOrCanonicalizeDescription,
  richTextToPlainText,
} from '@/features/clinicDashboard/profile/richText'

describe('clinic profile rich-text mapping', () => {
  it('preserves untouched structured rich text exactly', () => {
    const existing = {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            version: 1,
            children: [
              { type: 'text', text: 'Before ' },
              {
                type: 'link',
                fields: { url: 'https://example.com' },
                children: [{ type: 'text', text: 'link' }],
              },
            ],
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
      customMetadata: { preserved: true },
    }

    const result = preserveOrCanonicalizeDescription({
      existing,
      nextText: 'Before link',
    })

    expect(result).toEqual(existing)
    expect(result).not.toBe(existing)
  })

  it('canonicalizes deliberately changed text into paragraphs', () => {
    const result = canonicalizeDescriptionText('First line\r\ncontinues\r\n\r\nSecond paragraph')

    expect(richTextToPlainText(result)).toBe('First line\ncontinues\n\nSecond paragraph')
    expect((result?.root as { children: unknown[] }).children).toHaveLength(2)
  })

  it('maps an intentional empty description to null', () => {
    expect(canonicalizeDescriptionText('')).toBeNull()
  })
})
