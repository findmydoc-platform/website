import type { Meta, StoryObj } from '@storybook/react-vite'

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
}
