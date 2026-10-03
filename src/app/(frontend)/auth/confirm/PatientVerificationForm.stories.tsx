import type { Meta, StoryObj } from '@storybook/react-vite'
import { PatientVerificationForm } from './PatientVerificationForm'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'

const meta = {
  title: 'Domain/Auth/Pages/PatientVerification',
  component: PatientVerificationForm,
  tags: ['autodocs', 'domain:auth', 'layer:page', 'status:stable', 'used-in:route:/auth/confirm'],
  decorators: [
    (Story) => (
      <PublicAuthRouteShell>
        <Story />
      </PublicAuthRouteShell>
    ),
  ],
} satisfies Meta<typeof PatientVerificationForm>
export default meta
type Story = StoryObj<typeof meta>
export const Confirmation: Story = { args: { csrf: 'offline-story-context' } }
export const InvalidLink: Story = { args: { csrf: null } }
