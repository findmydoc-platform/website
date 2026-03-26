import type { Meta, StoryObj } from '@storybook/react-vite'
import { Footer } from '@/components/templates/Footer/Component'
import { footerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeFooterNavGroups } from '@/utilities/normalizeNavItems'

const meta = {
  title: 'Shared/Templates/Footer',
  component: Footer,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:shared', 'layer:template', 'status:stable', 'used-in:route:/'],
  args: {
    footerGroups: normalizeFooterNavGroups(footerData),
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
