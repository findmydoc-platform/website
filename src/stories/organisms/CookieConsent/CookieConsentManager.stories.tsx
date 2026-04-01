import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { CookieConsentBanner } from '@/components/organisms/CookieConsent/CookieConsentBanner.client'
import { CookieConsentDialog } from '@/components/organisms/CookieConsent/CookieConsentDialog.client'
import { CookieConsentLauncher } from '@/components/organisms/CookieConsent/CookieConsentLauncher.client'
import { CookieConsentManager } from '@/components/organisms/CookieConsent/CookieConsentManager.client'
import { DEFAULT_COOKIE_CONSENT_CONFIG } from '@/features/cookieConsent'

const meta = {
  title: 'Organisms/Cookie Consent',
  component: CookieConsentManager,
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
