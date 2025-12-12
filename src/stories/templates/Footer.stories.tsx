import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FooterContent } from '@/components/templates/Footer/FooterContent'
import { footerData, headerData } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import type { UiLinkProps } from '@/components/molecules/Link'

function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

function normalizeNavItems(data: {
  navItems?: Array<{ link?: { url?: string | null; label?: string; newTab?: boolean | null } }> | null
}): UiLinkProps[] {
  return (data?.navItems ?? [])
    .map((item) => {
      const href = item?.link?.url
      if (typeof href !== 'string' || href.length === 0) return null

      return {
        href,
        label: item?.link?.label ?? null,
        newTab: !!item?.link?.newTab,
        appearance: 'inline',
      } satisfies UiLinkProps
    })
    .filter(isNotNull)
}

const meta = {
  title: 'Templates/Footer',
  component: FooterContent,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    footerNavItems: normalizeNavItems(footerData),
    headerNavItems: normalizeNavItems(headerData),
  },
} satisfies Meta<typeof FooterContent>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FocusedLegalLinks: Story = {
  args: {
    footerNavItems: normalizeNavItems({ navItems: footerData.navItems?.slice(0, 1) ?? null }),
    headerNavItems: [],
  },
}

export const WithoutNavLinks: Story = {
  args: {
    footerNavItems: [],
    headerNavItems: [],
  },
}
