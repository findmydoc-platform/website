import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Header } from '@/components/templates/Header/Component'
import { PreviewDataNotice, PREVIEW_DATA_NOTICE_COPY } from '@/components/templates/PreviewDataNotice/Component'
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

const previewDataNoticeChromeBase: Story = {
  args: {
    navItems: denseNavItems,
    showPreviewBadge: true,
  },
  render: (args) => (
    <>
      <Header {...args} />
      <PreviewDataNotice />
      <main className="min-h-80 bg-site-canvas px-6 py-8 text-sm text-muted-foreground">
        Preview route content begins below the notice.
      </main>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('PREVIEW')).toBeInTheDocument()
    await expect(canvas.getByRole('note', { name: 'Preview data notice' })).toHaveTextContent(PREVIEW_DATA_NOTICE_COPY)
  },
}

/** Header with flat navigation items (no submenus). */
export const Default: Story = {}

/** Header with only two navigation items. */
export const CompactNav: Story = {
  args: {
    navItems: navItems.slice(0, 2),
  },
}

const emptyNavigationBase: Story = {
  args: {
    navItems: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument()
    expect(canvas.queryByLabelText('Mobile navigation')).not.toBeInTheDocument()
  },
}

/** Header without CMS navigation items on mobile. */
export const EmptyNavigation: Story = withViewportStory(emptyNavigationBase, 'public375', 'Empty navigation / 375')

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

export const PreviewDataNoticeChrome320: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public320',
  'Preview data notice chrome / 320',
)
export const PreviewDataNoticeChrome375: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public375',
  'Preview data notice chrome / 375',
)
export const PreviewDataNoticeChrome640: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public640',
  'Preview data notice chrome / 640',
)
export const PreviewDataNoticeChrome768: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public768',
  'Preview data notice chrome / 768',
)
export const PreviewDataNoticeChrome1024: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public1024',
  'Preview data notice chrome / 1024',
)
export const PreviewDataNoticeChrome320Short: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public320Short',
  'Preview data notice chrome / 320 short',
)
export const PreviewDataNoticeChrome375Short: Story = withViewportStory(
  previewDataNoticeChromeBase,
  'public375Short',
  'Preview data notice chrome / 375 short',
)
