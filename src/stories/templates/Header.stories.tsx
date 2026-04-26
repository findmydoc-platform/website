import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { Header } from '@/components/templates/Header/Component'
import { headerData, headerDataWithSubmenus } from './fixtures'
import { withMockRouter } from '../utils/routerDecorator'
import { normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { withViewportStory } from '../utils/viewportMatrix'

const navItems = normalizeHeaderNavItems(headerData)
const navItemsWithSubs = normalizeHeaderNavItems(headerDataWithSubmenus)
const denseNavItems = navItemsWithSubs.map((item, index) => ({
  ...item,
  label: index === 0 ? 'Compare international clinics' : item.label,
  subItems: item.subItems?.map((sub, subIndex) => ({
    ...sub,
    label: subIndex === 0 ? `${sub.label} and treatment guidance` : sub.label,
  })),
}))

const meta = {
  title: 'Shared/Templates/Header',
  component: Header,
  decorators: [withMockRouter],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Site header with logo and main navigation. Supports flat links and two-level navigation with dropdown submenus on desktop and accordion on mobile.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:template', 'status:stable', 'used-in:route:/'],
  args: {
    navItems,
  },
} satisfies Meta<typeof Header>

export default meta

type Story = StoryObj<typeof meta>

const runMobileDenseNavigationFlow: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = within(canvasElement)

  await userEvent.click(canvas.getByRole('button', { name: /open menu/i }))

  const mobileNav = canvas.getByLabelText('Mobile navigation')
  const mobileCanvas = within(mobileNav)
  const clinicsTrigger = mobileCanvas.getByRole('button', { name: 'Compare international clinics' })

  await userEvent.click(clinicsTrigger)
  await expect(mobileCanvas.getByRole('link', { name: /all clinics and treatment guidance/i })).toBeInTheDocument()

  await userEvent.click(canvas.getByRole('button', { name: /close menu/i }))
  await waitFor(() => {
    expect(canvas.queryByLabelText('Mobile navigation')).not.toBeInTheDocument()
  })
}

/** Header with flat navigation items (no submenus). */
export const Default: Story = {}

/** Header with only two navigation items. */
export const CompactNav: Story = {
  args: {
    navItems: navItems.slice(0, 2),
  },
}

/** Header with submenu items on selected top-level entries. */
export const WithSubmenus: Story = {
  args: {
    navItems: navItemsWithSubs,
  },
}

/** Header stress case with longer mobile labels and nested links. */
export const DenseNavigation: Story = {
  args: {
    navItems: denseNavItems,
  },
}

export const DenseNavigation320: Story = withViewportStory(DenseNavigation, 'public320', 'Dense navigation / 320')
export const DenseNavigation375: Story = withViewportStory(DenseNavigation, 'public375', 'Dense navigation / 375')
export const DenseNavigation640: Story = withViewportStory(DenseNavigation, 'public640', 'Dense navigation / 640')
export const DenseNavigation768: Story = withViewportStory(DenseNavigation, 'public768', 'Dense navigation / 768')
export const DenseNavigation1024: Story = withViewportStory(DenseNavigation, 'public1024', 'Dense navigation / 1024')
export const DenseNavigation1280: Story = withViewportStory(DenseNavigation, 'public1280', 'Dense navigation / 1280')
export const DenseNavigation320Short: Story = withViewportStory(
  DenseNavigation,
  'public320Short',
  'Dense navigation / 320 short',
)
export const DenseNavigation375Short: Story = withViewportStory(
  DenseNavigation,
  'public375Short',
  'Dense navigation / 375 short',
)

DenseNavigation320.play = runMobileDenseNavigationFlow
DenseNavigation375.play = runMobileDenseNavigationFlow
DenseNavigation640.play = runMobileDenseNavigationFlow
DenseNavigation768.play = runMobileDenseNavigationFlow
DenseNavigation320Short.play = runMobileDenseNavigationFlow
DenseNavigation375Short.play = runMobileDenseNavigationFlow
