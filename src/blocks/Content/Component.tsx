import React from 'react'
import type { ContentBlock as ContentBlockProps, PlatformContentMedia } from '@/payload-types'
import { Content } from '@/components/organisms/Content'
import type { ContentColumn, ContentImage } from '@/components/organisms/Content'
import RichText from '@/blocks/_shared/RichText'

function pickImageSrc(m?: PlatformContentMedia | number | string | null, preferredSize?: string): ContentImage {
  if (!m || typeof m === 'number' || typeof m === 'string') {
    return { src: undefined, width: undefined, height: undefined, alt: '' }
  }

  const sizesRecord = (m.sizes ?? {}) as Record<
    string,
    { url?: string | null; width?: number | null; height?: number | null }
  >
  const sizeKey = preferredSize && sizesRecord?.[preferredSize] ? preferredSize : undefined
  const chosen = sizeKey ? sizesRecord[sizeKey] : undefined
  const src = (chosen?.url ?? m.url) || undefined
  const width = chosen?.width ?? m.width ?? undefined
  const height = chosen?.height ?? m.height ?? undefined
  return { src, width, height, alt: m.alt ?? '' }
}

type LinkLike = {
  type?: 'custom' | 'reference' | null
  url?: string | null
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo?: string
    value?: unknown
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function resolvePresentLink(enableLink: boolean, link: unknown): ContentColumn['link'] | undefined {
  if (!enableLink) return undefined
  if (!isRecord(link)) return undefined

  const l = link as LinkLike

  let href: string | undefined

  if (l.type === 'reference' && l.reference?.relationTo && isRecord(l.reference.value)) {
    const slug = l.reference.value['slug']
    if (typeof slug === 'string' && slug.length > 0) {
      const relationTo = l.reference.relationTo
      href = `${relationTo !== 'pages' ? `/${relationTo}` : ''}/${slug}`
    }
  }

  if (!href && typeof l.url === 'string' && l.url.length > 0) {
    href = l.url
  }

  if (!href) return undefined

  return {
    href,
    label: l.label ?? null,
    newTab: !!l.newTab,
  }
}

export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props

  const presentColumns: ContentColumn[] | undefined = React.useMemo(() => {
    if (!columns) return undefined

    return columns.map((col) => {
      const { enableLink, link, richText, size, image, imagePosition, imageSize, caption } = col

      const sizeKey = (size ?? 'oneThird') as ContentColumn['size']
      const preferredSize = imageSize === 'full' ? undefined : 'card'
      const imageProps = pickImageSrc(image as PlatformContentMedia | number | string | null, preferredSize)

      const normalizedImagePosition = (imagePosition ?? 'top') as ContentColumn['imagePosition']
      const normalizedImageSize = (imageSize ?? 'content') as ContentColumn['imageSize']

      const richTextNode = richText ? <RichText data={richText} enableGutter={false} /> : undefined
      const presentLink = resolvePresentLink(!!enableLink, link)

      return {
        link: presentLink,
        richText: richTextNode,
        size: sizeKey,
        image: imageProps,
        imagePosition: normalizedImagePosition,
        imageSize: normalizedImageSize,
        caption: caption ?? null,
      }
    })
  }, [columns])

  return <Content columns={presentColumns} />
}
