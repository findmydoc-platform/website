interface RichTextTextNode {
  [key: string]: unknown
  type: 'text'
  text: string
}

interface RichTextLinkNode {
  [key: string]: unknown
  type: 'link'
  id: string
  fields: {
    linkType: 'internal'
    doc: {
      relationTo: 'posts'
      value: number
    }
    newTab: boolean
  }
  children: RichTextTextNode[]
  direction: null
  format: ''
  indent: 0
  version: 3
}

type RichTextNode = RichTextTextNode | RichTextLinkNode

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

export const buildRichTextWithInternalPostLink = (args: {
  beforeText?: string
  linkText: string
  postId: number
}): RichTextValue => {
  const children: RichTextNode[] = []

  if (args.beforeText) {
    children.push({ type: 'text', text: args.beforeText })
  }

  children.push({
    type: 'link',
    id: 'internal-post-link',
    fields: {
      linkType: 'internal',
      doc: {
        relationTo: 'posts',
        value: args.postId,
      },
      newTab: false,
    },
    children: [{ type: 'text', text: args.linkText }],
    direction: null,
    format: '',
    indent: 0,
    version: 3,
  })

  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}
