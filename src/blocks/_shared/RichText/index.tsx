import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { DefaultNodeTypes, SerializedBlockNode, SerializedLinkNode } from '@payloadcms/richtext-lexical'
import { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as RichTextWithoutBlocks,
} from '@payloadcms/richtext-lexical/react'

import type {
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  MediaBlock as MediaBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { resolveHrefFromReference } from '@/blocks/_shared/utils'
import { cn } from '@/utilities/ui'
import { containerVariants } from '@/components/molecules/Container'
import type { ContentLocaleContext } from '@/utilities/contentLocalization'

type NodeTypes = DefaultNodeTypes | SerializedBlockNode<CTABlockProps | MediaBlockProps | BannerBlockProps>

const createJsxConverters =
  (contentLocale?: ContentLocaleContext): JSXConvertersFunction<NodeTypes> =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkJSXConverter({
      internalDocToHref: ({ linkNode }: { linkNode: SerializedLinkNode }) => {
        const doc = linkNode.fields.doc

        if (!doc) {
          throw new Error('Expected doc to exist on internal rich text link')
        }

        const href = resolveHrefFromReference(
          {
            relationTo: doc.relationTo,
            value: doc.value,
          },
          contentLocale,
        )

        if (!href) {
          throw new Error('Expected internal rich text link to resolve to a href')
        }

        return href
      },
    }),
    blocks: {
      banner: ({ node }) => <BannerBlock className="col-start-2 mb-4" contentLocale={contentLocale} {...node.fields} />,
      mediaBlock: ({ node }) => (
        <MediaBlock
          className="col-span-3 col-start-1"
          imgClassName="m-0"
          {...node.fields}
          captionClassName="mx-auto max-w-3xl"
          contentLocale={contentLocale}
          enableGutter={false}
          disableInnerContainer={true}
        />
      ),
      cta: ({ node }) => <CallToActionBlock contentLocale={contentLocale} {...node.fields} />,
    },
  })

type Props = {
  data: SerializedEditorState
  contentLocale?: ContentLocaleContext
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, contentLocale, enableProse = true, enableGutter = true, ...rest } = props

  return (
    <RichTextWithoutBlocks
      converters={createJsxConverters(contentLocale)}
      className={cn(
        {
          [containerVariants({ variant: 'default' })]: enableGutter,
          'max-w-none': !enableGutter,
          'md:prose-md mx-auto prose-sm sm:prose': enableProse,
        },
        className,
      )}
      {...rest}
    />
  )
}
