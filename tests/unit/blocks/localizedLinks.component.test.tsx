import type { Page, Post } from '@/payload-types'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callToActionComponent: vi.fn((_props: unknown) => null),
  contentComponent: vi.fn((_props: unknown) => null),
  richTextComponent: vi.fn((_props: unknown) => null),
}))

vi.mock('@/components/organisms/CallToAction', () => ({
  CallToAction: mocks.callToActionComponent,
}))

vi.mock('@/components/organisms/Content', () => ({
  Content: mocks.contentComponent,
}))

vi.mock('@/blocks/_shared/RichText', () => ({
  default: mocks.richTextComponent,
}))

describe('locale-aware block links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('localizes content block column links and rich text', async () => {
    const { ContentBlock } = await import('@/blocks/Content/Component')

    renderToStaticMarkup(
      <ContentBlock
        blockType="content"
        columns={[
          {
            enableLink: true,
            link: {
              type: 'reference',
              label: 'Privacy Policy',
              reference: {
                relationTo: 'pages',
                value: { slug: 'privacy-policy' } as unknown as Page,
              },
            },
            richText: {
              root: {
                type: 'root',
                children: [],
                direction: null,
                format: '',
                indent: 0,
                version: 1,
              },
            },
          },
        ]}
        contentLocale={{ locale: 'de', fallbackLocale: 'en' }}
      />,
    )

    expect(mocks.contentComponent).toHaveBeenCalledTimes(1)
    const contentProps = mocks.contentComponent.mock.calls[0]?.[0] as
      | {
          columns?: Array<{
            link?: unknown
            richText?: unknown
          }>
        }
      | undefined

    expect(contentProps?.columns?.[0]?.link).toEqual({
      href: '/privacy-policy?locale=de',
      label: 'Privacy Policy',
      newTab: false,
    })
    const contentRichTextNode = contentProps?.columns?.[0]?.richText as
      | { props?: { contentLocale?: unknown } }
      | undefined
    expect(contentRichTextNode?.props?.contentLocale).toEqual({
      locale: 'de',
      fallbackLocale: 'en',
    })
  })

  it('localizes CTA links and rich text content', async () => {
    const { CallToActionBlock } = await import('@/blocks/CallToAction/Component')

    renderToStaticMarkup(
      <CallToActionBlock
        blockType="cta"
        contentLocale={{ locale: 'de', fallbackLocale: 'en' }}
        links={[
          {
            link: {
              type: 'reference',
              label: 'Read the Guide',
              reference: {
                relationTo: 'posts',
                value: { slug: 'localization-guide-post' } as unknown as Post,
              },
            },
          },
        ]}
        richText={{
          root: {
            type: 'root',
            children: [],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        }}
      />,
    )

    expect(mocks.callToActionComponent).toHaveBeenCalledTimes(1)
    const ctaProps = mocks.callToActionComponent.mock.calls[0]?.[0] as
      | {
          links?: unknown
          richText?: unknown
        }
      | undefined

    expect(ctaProps?.links).toEqual([
      {
        href: '/posts/localization-guide-post?locale=de',
        label: 'Read the Guide',
        newTab: false,
        appearance: 'inline',
      },
    ])
    const ctaRichTextNode = ctaProps?.richText as { props?: { contentLocale?: unknown } } | undefined
    expect(ctaRichTextNode?.props?.contentLocale).toEqual({
      locale: 'de',
      fallbackLocale: 'en',
    })
  })
})
