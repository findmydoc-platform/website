import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { CookieConsentBanner } from '@/components/organisms/CookieConsent/CookieConsentBanner.client'
import { CookieConsentDialog } from '@/components/organisms/CookieConsent/CookieConsentDialog.client'
import { CookieConsentLauncher } from '@/components/organisms/CookieConsent/CookieConsentLauncher.client'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import { DEFAULT_COOKIE_CONSENT_CONFIG } from '@/features/cookieConsent'

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
