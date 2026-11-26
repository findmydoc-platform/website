import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'

import RichText from '@/blocks/_shared/RichText'

it('renders the label as plain text if the internal destination is unavailable in the current locale', () => {
  const paragraph = {
    type: 'paragraph',
    version: 1,
    children: [
      {
        type: 'link',
        version: 3,
        fields: { linkType: 'internal', doc: { relationTo: 'pages', value: 10 } },
        children: [{ type: 'text', version: 1, text: 'Read our guide' }],
      },
    ],
  }
  const html = renderToStaticMarkup(
    <RichText
      contentLocale={{ locale: 'en', fallbackLocale: false }}
      data={{
        root: {
          type: 'root',
          children: [paragraph],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      }}
    />,
  )

  expect(html).toContain('<p>Read our guide</p>')
  expect(html).not.toContain('<a ')
})
