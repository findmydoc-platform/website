import { describe, expect, it } from 'vitest'

import { escapeMarkdownInlineText, formatAccess } from '../../../scripts/permission-matrix/derive-json'

describe('permission matrix markdown generation', () => {
  it('escapes HTML control characters and markdown table separators', () => {
    expect(escapeMarkdownInlineText(`clinic | <script>alert("x")</script> & 'owned'`)).toBe(
      'clinic &#124; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;owned&#39;',
    )
  })

  it('sanitizes conditional access details before embedding them in generated markdown', () => {
    expect(
      formatAccess({
        type: 'conditional',
        details: 'platform | clinic </sub><script>alert(1)</script>',
      }),
    ).toBe('Conditional<br/><sub>platform &#124; clinic &lt;/sub&gt;&lt;script&gt;alert(1)&lt;/script&gt;</sub>')
  })
})
