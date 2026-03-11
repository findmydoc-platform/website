import type { Meta, StoryObj } from '@storybook/react-vite'

import { VerificationBadge } from '@/components/atoms/verification-badge'

const meta = {
  title: 'Shared/Atoms/VerificationBadge',
  component: VerificationBadge,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof VerificationBadge>

export default meta

type Story = StoryObj<typeof meta>

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <VerificationBadge variant="unverified" />
      <VerificationBadge variant="bronze" />
      <VerificationBadge variant="silver" />
      <VerificationBadge variant="gold" />
    </div>
  ),
}
