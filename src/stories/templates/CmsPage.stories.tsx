import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import RichText from '@/blocks/_shared/RichText'
import { Heading } from '@/components/atoms/Heading'
import { Content } from '@/components/organisms/Content'
import type { ContentColumn } from '@/components/organisms/Content'
import { Container } from '@/components/molecules/Container'
import contentClinicInterior from '../assets/content-clinic-interior.jpg'
import { sampleRichText } from '../organisms/fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { withViewportStory } from '../utils/viewportMatrix'

const getSrc = (img: string | { src: string }) => (typeof img === 'string' ? img : img?.src)

const pageColumns: ContentColumn[] = [
  {
    size: 'half',
    richText: (
      <div className="space-y-3">
        <p className="text-lg font-semibold">Comparing treatment pathways</p>
        <p className="text-muted-foreground">
          Use concise sections, supporting imagery, and trustworthy details to keep long-form CMS pages readable on
          mobile.
        </p>
      </div>
    ),
    image: {
      src: getSrc(contentClinicInterior),
      width: 1600,
      height: 1063,
      alt: 'Bright clinic interior corridor',
    },
    imagePosition: 'right',
    caption: 'Example supporting media for a CMS-driven explainer page',
    link: {
      href: '/posts',
      label: 'Read related articles',
    },
  },
  {
    size: 'half',
    richText: (
      <div className="space-y-3">
        <p className="text-lg font-semibold">What patients need next</p>
        <p className="text-muted-foreground">
          Stack dense text, subheadings, and links so the CTA hierarchy stays clear from 320px upward.
        </p>
      </div>
    ),
  },
]

const legalDenseColumns: ContentColumn[] = [
  {
    size: 'full',
    richText: (
      <div className="space-y-4 text-muted-foreground">
        <p className="text-base font-semibold text-foreground">Data processing overview</p>
        <p>
          We process personal data only where a lawful basis exists, including the provision of the website, response
          handling, abuse prevention, analytics when consent is granted, and legal retention duties.
        </p>
        <p>
          Depending on the request, this may include connection metadata, browser details, submitted contact
          information, consent preferences, and service logs required to keep the platform secure and understandable for
          users across jurisdictions.
        </p>
        <p>
          Where processors are involved, they are bound by written agreements and may only use the data to provide the
          contracted service. International transfers require suitable safeguards and are documented in the applicable
          privacy information.
        </p>
      </div>
    ),
  },
]

const meta = {
  title: 'Domain/Cms/Templates/CmsPage',
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:cms', 'layer:template', 'status:stable', 'used-in:route:/(pages)/[...slug]'],
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const MixedBlocks: Story = {
  render: () => (
    <article className="pt-12 pb-20 sm:pt-16 sm:pb-24">
      <Container className="mb-8 sm:mb-12">
        <div className="mx-auto max-w-3xl">
          <Heading as="h1" size="h1" align="left" className="text-3xl sm:text-4xl">
            Planning a treatment abroad without losing context
          </Heading>
        </div>
      </Container>

      <RichText data={sampleRichText} />
      <Content columns={pageColumns} />
      <RichText data={sampleRichText} />
    </article>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Planning a treatment abroad without losing context' }),
    ).toBeInTheDocument()
    await expect(canvas.getByRole('img', { name: 'Bright clinic interior corridor' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Read related articles' })).toBeInTheDocument()
  },
}

export const MixedBlocks320: Story = withViewportStory(MixedBlocks, 'public320', 'Mixed blocks / 320')
export const MixedBlocks375: Story = withViewportStory(MixedBlocks, 'public375', 'Mixed blocks / 375')
export const MixedBlocks640: Story = withViewportStory(MixedBlocks, 'public640', 'Mixed blocks / 640')
export const MixedBlocks768: Story = withViewportStory(MixedBlocks, 'public768', 'Mixed blocks / 768')
export const MixedBlocks1024: Story = withViewportStory(MixedBlocks, 'public1024', 'Mixed blocks / 1024')
export const MixedBlocks1280: Story = withViewportStory(MixedBlocks, 'public1280', 'Mixed blocks / 1280')

export const LegalDense: Story = {
  render: () => (
    <article className="pt-12 pb-20 sm:pt-16 sm:pb-24">
      <Container className="mb-8 sm:mb-12">
        <div className="mx-auto max-w-3xl">
          <Heading as="h1" size="h1" align="left" className="text-3xl sm:text-4xl">
            Privacy information and legal responsibilities
          </Heading>
        </div>
      </Container>

      <Content columns={legalDenseColumns} />
      <Content columns={legalDenseColumns} />
    </article>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole('heading', { name: 'Privacy information and legal responsibilities' }),
    ).toBeInTheDocument()
    await expect(canvas.getAllByText('Data processing overview').length).toBeGreaterThanOrEqual(1)
  },
}

export const LegalDense320: Story = withViewportStory(LegalDense, 'public320', 'Legal dense / 320')
export const LegalDense375: Story = withViewportStory(LegalDense, 'public375', 'Legal dense / 375')
export const LegalDense640: Story = withViewportStory(LegalDense, 'public640', 'Legal dense / 640')
export const LegalDense768: Story = withViewportStory(LegalDense, 'public768', 'Legal dense / 768')
export const LegalDense1024: Story = withViewportStory(LegalDense, 'public1024', 'Legal dense / 1024')
export const LegalDense1280: Story = withViewportStory(LegalDense, 'public1280', 'Legal dense / 1280')
