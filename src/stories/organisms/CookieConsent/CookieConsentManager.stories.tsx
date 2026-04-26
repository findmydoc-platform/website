import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { CookieConsentBanner } from '@/components/organisms/CookieConsent/CookieConsentBanner.client'
import { CookieConsentDialog } from '@/components/organisms/CookieConsent/CookieConsentDialog.client'
import { CookieConsentLauncher } from '@/components/organisms/CookieConsent/CookieConsentLauncher.client'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import { DEFAULT_COOKIE_CONSENT_CONFIG } from '@/features/cookieConsent'
import { withViewportStory } from '../../utils/viewportMatrix'

const denseCookieConsentConfig = {
  ...DEFAULT_COOKIE_CONSENT_CONFIG,
  banner: {
    ...DEFAULT_COOKIE_CONSENT_CONFIG.banner,
    description:
      'We use essential cookies to keep the website working and optional cookies to understand journeys, improve comparison flows, and support embedded services across the public findmydoc experience.',
    customizeLabel: 'Review cookie settings',
  },
  categories: DEFAULT_COOKIE_CONSENT_CONFIG.categories.map((category, index) => ({
    ...category,
    description:
      index === 0
        ? `${category.description} This includes analytics signals that help us understand how visitors move from the holding page to public patient flows.`
        : category.description,
  })),
}

const authRouteCookieConsentConfig = {
  ...denseCookieConsentConfig,
  banner: {
    ...denseCookieConsentConfig.banner,
    title: 'Allow optional cookies before continuing with your secure patient or clinic sign-in flow.',
    description:
      'We keep essential cookies enabled for secure sign-in and optional cookies available for journey analytics, embedded support, and comparison improvements while you move between public auth routes.',
    customizeLabel: 'Choose settings',
  },
  settings: {
    ...denseCookieConsentConfig.settings,
    description:
      'Review the optional cookies that support sign-in help, comparison analytics, and embedded trust content before continuing through the public patient and clinic account flows.',
    saveLabel: 'Save auth settings',
  },
  categories: denseCookieConsentConfig.categories.map((category, index) => ({
    ...category,
    description:
      index === 0
        ? `${category.description} This can include sign-in assistance, handoff analytics, and support signals across patient and clinic registration routes.`
        : `${category.description} This may appear while moving between login, patient registration, and clinic registration pages.`,
  })),
}

const meta = {
  title: 'Domain/Shared/Organisms/CookieConsent',
  component: CookieConsentManager,
  tags: ['autodocs', 'domain:shared', 'layer:organism', 'status:stable', 'used-in:shared'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CookieConsentManager>

export default meta

type Story = StoryObj<typeof meta>

export const Banner: Story = {
  args: {
    config: DEFAULT_COOKIE_CONSENT_CONFIG,
    initialConsent: null,
  },
  render: () => (
    <CookieConsentBanner
      config={DEFAULT_COOKIE_CONSENT_CONFIG}
      onAcceptAll={() => {}}
      onCustomize={() => {}}
      onRejectAll={() => {}}
    />
  ),
}

export const Launcher: Story = {
  args: {
    config: DEFAULT_COOKIE_CONSENT_CONFIG,
    initialConsent: null,
  },
  render: () => <CookieConsentLauncher label={DEFAULT_COOKIE_CONSENT_CONFIG.reopenLabel} onOpenSettings={() => {}} />,
}

export const Dialog: Story = {
  args: {
    config: DEFAULT_COOKIE_CONSENT_CONFIG,
    initialConsent: null,
  },
  render: () => {
    const DialogStory = () => {
      const [open, setOpen] = React.useState(true)
      const [categoryDrafts, setCategoryDrafts] = React.useState(
        Object.fromEntries(DEFAULT_COOKIE_CONSENT_CONFIG.categories.map((category) => [category.key, true])),
      )

      return (
        <CookieConsentDialog
          open={open}
          config={DEFAULT_COOKIE_CONSENT_CONFIG}
          categoryDrafts={categoryDrafts}
          onCancel={() => setOpen(false)}
          onOpenChange={setOpen}
          onRejectAll={() => {}}
          onSave={() => {}}
          onToggleCategory={(key, checked) => {
            setCategoryDrafts((current) => ({
              ...current,
              [key]: checked,
            }))
          }}
        />
      )
    }

    return <DialogStory />
  },
}

export const Manager: Story = {
  args: {
    config: DEFAULT_COOKIE_CONSENT_CONFIG,
    initialConsent: null,
  },
}

export const BannerLongCopy: Story = {
  args: {
    config: denseCookieConsentConfig,
    initialConsent: null,
  },
  render: () => (
    <CookieConsentBanner
      config={denseCookieConsentConfig}
      onAcceptAll={() => {}}
      onCustomize={() => {}}
      onRejectAll={() => {}}
    />
  ),
}

const authCompactBannerBase: Story = {
  args: {
    config: authRouteCookieConsentConfig,
    initialConsent: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/login/patient',
      },
    },
  },
  render: () => {
    return (
      <div className="min-h-screen bg-background pb-28">
        <CookieConsentManager config={authRouteCookieConsentConfig} initialConsent={null} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body)
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: /choose settings/i })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /choose settings/i }))
    await expect(documentBody.getByRole('dialog', { name: /cookie settings/i })).toBeInTheDocument()
    await userEvent.click(documentBody.getByRole('button', { name: /cancel/i }))
    await expect(documentBody.queryByRole('dialog', { name: /cookie settings/i })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /choose settings/i })).toBeInTheDocument()
  },
}

const authDialogBase: Story = {
  args: {
    config: authRouteCookieConsentConfig,
    initialConsent: null,
  },
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/register/patient',
      },
    },
  },
  render: () => {
    return (
      <div className="min-h-screen bg-background">
        <CookieConsentManager config={authRouteCookieConsentConfig} initialConsent={null} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body)

    await userEvent.click(within(canvasElement).getByRole('button', { name: /choose settings/i }))
    await expect(documentBody.getByRole('dialog', { name: /cookie settings/i })).toBeInTheDocument()
    await userEvent.click(documentBody.getByRole('checkbox', { name: /analytics cookies/i }))
    await expect(documentBody.getByRole('checkbox', { name: /analytics cookies/i })).toBeChecked()
    await expect(documentBody.getByRole('button', { name: /save auth settings/i })).toBeInTheDocument()
  },
}

export const AuthCompactBanner320: Story = withViewportStory(
  authCompactBannerBase,
  'public320',
  'Auth compact banner / 320',
)
export const AuthCompactBanner375: Story = withViewportStory(
  authCompactBannerBase,
  'public375',
  'Auth compact banner / 375',
)
export const AuthCompactBanner640: Story = withViewportStory(
  authCompactBannerBase,
  'public640',
  'Auth compact banner / 640',
)
export const AuthCompactBanner768: Story = withViewportStory(
  authCompactBannerBase,
  'public768',
  'Auth compact banner / 768',
)
export const AuthCompactBanner1024: Story = withViewportStory(
  authCompactBannerBase,
  'public1024',
  'Auth compact banner / 1024',
)
export const AuthCompactBanner1280: Story = withViewportStory(
  authCompactBannerBase,
  'public1280',
  'Auth compact banner / 1280',
)
export const AuthCompactBanner375Short: Story = withViewportStory(
  authCompactBannerBase,
  'public375Short',
  'Auth compact banner / 375 short',
)

export const AuthDialog320: Story = withViewportStory(authDialogBase, 'public320', 'Auth dialog / 320')
export const AuthDialog375: Story = withViewportStory(authDialogBase, 'public375', 'Auth dialog / 375')
export const AuthDialog640: Story = withViewportStory(authDialogBase, 'public640', 'Auth dialog / 640')
export const AuthDialog768: Story = withViewportStory(authDialogBase, 'public768', 'Auth dialog / 768')
export const AuthDialog1024: Story = withViewportStory(authDialogBase, 'public1024', 'Auth dialog / 1024')
export const AuthDialog1280: Story = withViewportStory(authDialogBase, 'public1280', 'Auth dialog / 1280')
export const AuthDialog375Short: Story = {
  ...withViewportStory(authDialogBase, 'public375Short', 'Auth dialog / 375 short'),
  play: async ({ canvasElement }) => {
    const documentBody = within(canvasElement.ownerDocument.body)

    await userEvent.click(within(canvasElement).getByRole('button', { name: /choose settings/i }))
    await expect(documentBody.getByRole('dialog', { name: /cookie settings/i })).toBeInTheDocument()
    await userEvent.click(documentBody.getByRole('checkbox', { name: /analytics cookies/i }))

    const saveButton = documentBody.getByRole('button', { name: /save auth settings/i })
    const cancelButton = documentBody.getByRole('button', { name: /cancel/i })

    saveButton.scrollIntoView({ block: 'nearest' })
    await expect(saveButton).toBeVisible()

    cancelButton.scrollIntoView({ block: 'nearest' })
    await expect(cancelButton).toBeVisible()
  },
}
