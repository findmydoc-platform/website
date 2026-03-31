import type { Meta, StoryObj } from '@storybook/react-vite'

import { SocialLink } from '@/components/molecules/SocialLink'
import { Mail } from 'lucide-react'

const meta = {
  title: 'Shared/Molecules/SocialLink',
  component: SocialLink,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
  argTypes: {
    platform: {
      control: 'select',
      options: ['meta', 'x', 'instagram', 'linkedin', 'github', undefined],
    },
    variant: {
      control: 'select',
      options: ['default', 'outline', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg'],
    },
  },
} satisfies Meta<typeof SocialLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    platform: 'meta',
    href: '#',
    'aria-label': 'Meta',
  },
}

export const Outline: Story = {
  args: {
    ...Default.args,
    variant: 'outline',
  },
}

export const Ghost: Story = {
  args: {
    ...Default.args,
    variant: 'ghost',
  },
}

export const Small: Story = {
  args: {
    ...Default.args,
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    ...Default.args,
    size: 'lg',
  },
}

export const AllPlatforms: Story = {
  render: (args) => (
    <div className="flex gap-4">
      <SocialLink {...args} platform="meta" href="#" aria-label="Meta" />
      <SocialLink {...args} platform="x" href="#" aria-label="X" />
      <SocialLink {...args} platform="instagram" href="#" aria-label="Instagram" />
      <SocialLink {...args} platform="linkedin" href="#" aria-label="LinkedIn" />
      <SocialLink {...args} platform="github" href="#" aria-label="GitHub" />
    </div>
  ),
}

export const WithCustomChild: Story = {
  args: {
    variant: 'outline',
    href: 'mailto:info@example.com',
    'aria-label': 'Email',
    children: <Mail className="h-4 w-4" />,
  },
}
