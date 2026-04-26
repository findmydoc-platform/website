import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'
import { Footer } from '@/components/templates/Footer/Component'
import { footerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeFooterNavGroups } from '@/utilities/normalizeNavItems'
import { withViewportStory } from '../utils/viewportMatrix'

const normalizedFooterGroups = normalizeFooterNavGroups(footerData)
const denseFooterGroups = normalizedFooterGroups.map((group, index) => ({
  ...group,
  items: group.items.map((item, itemIndex) => ({
    ...item,
    label: index === 0 && itemIndex === 0 ? `${item.label} and patient guidance` : item.label,
  })),
}))

const meta = {
  title: 'Shared/Templates/Footer',
  component: Footer,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:shared', 'layer:template', 'status:stable', 'used-in:route:/'],
  args: {
    footerGroups: normalizedFooterGroups,
  },
} satisfies Meta<typeof Footer>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FocusedLegalLinks: Story = {
  args: {
    footerGroups: normalizeFooterNavGroups({
      ...footerData,
      aboutLinks: [],
      serviceLinks: [],
      informationLinks: footerData.informationLinks?.slice(0, 1) ?? null,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('link', { name: /imprint/i })).toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: /patient guidance/i })).not.toBeInTheDocument()
  },
}

export const WithoutNavLinks: Story = {
  args: {
    footerGroups: normalizeFooterNavGroups({
      ...footerData,
      aboutLinks: [],
      serviceLinks: [],
      informationLinks: [],
    }),
  },
}

export const DenseContent: Story = {
  args: {
    footerGroups: denseFooterGroups,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('link', { name: /patient guidance/i })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: /imprint/i })).toBeInTheDocument()
  },
}

export const FocusedLegalLinks320: Story = withViewportStory(
  FocusedLegalLinks,
  'public320',
  'Focused legal links / 320',
)
export const FocusedLegalLinks375: Story = withViewportStory(
  FocusedLegalLinks,
  'public375',
  'Focused legal links / 375',
)
export const FocusedLegalLinks640: Story = withViewportStory(
  FocusedLegalLinks,
  'public640',
  'Focused legal links / 640',
)
export const FocusedLegalLinks768: Story = withViewportStory(
  FocusedLegalLinks,
  'public768',
  'Focused legal links / 768',
)
export const FocusedLegalLinks1024: Story = withViewportStory(
  FocusedLegalLinks,
  'public1024',
  'Focused legal links / 1024',
)
export const FocusedLegalLinks1280: Story = withViewportStory(
  FocusedLegalLinks,
  'public1280',
  'Focused legal links / 1280',
)

export const DenseContent320: Story = withViewportStory(DenseContent, 'public320', 'Dense content / 320')
export const DenseContent375: Story = withViewportStory(DenseContent, 'public375', 'Dense content / 375')
export const DenseContent640: Story = withViewportStory(DenseContent, 'public640', 'Dense content / 640')
export const DenseContent768: Story = withViewportStory(DenseContent, 'public768', 'Dense content / 768')
export const DenseContent1024: Story = withViewportStory(DenseContent, 'public1024', 'Dense content / 1024')
export const DenseContent1280: Story = withViewportStory(DenseContent, 'public1280', 'Dense content / 1280')
