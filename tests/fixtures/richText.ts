interface RichTextNode {
  [key: string]: unknown
  type: 'text'
  text: string
}

interface RichTextParagraph {
  [key: string]: unknown
  type: 'paragraph'
  version: 1
  children: RichTextNode[]
}

interface RichTextRoot {
  [key: string]: unknown
  type: 'root'
  children: RichTextParagraph[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
}

export interface RichTextValue {
  [key: string]: unknown
  root: RichTextRoot
}

export const buildRichText = (text: string): RichTextValue => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'text', text }],
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})
