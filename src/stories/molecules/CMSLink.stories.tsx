import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CMSLink } from '@/components/molecules/Link'

const meta = {
  title: 'Molecules/CMSLink',
  component: CMSLink,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    appearance: {
      control: 'select',
      options: ['inline', 'default', 'primary', 'secondary', 'accent', 'link', 'outline'],
    },
  },
} satisfies Meta<typeof CMSLink>

export default meta
type Story = StoryObj<typeof meta>

export const Inline: Story = {
  render: (args) => (
    <p className="text-sm">
      Discover our{' '}
      <CMSLink {...args} appearance="inline" url="/clinics">
        clinic directory
      </CMSLink>{' '}
      to compare treatments.
    </p>
  ),
}

export const ButtonVariant: Story = {
  args: {
    appearance: 'primary',
    label: 'Book consultation',
    url: '/book',
  },
  render: (args) => <CMSLink {...args} />,
}

export const External: Story = {
  args: {
    appearance: 'link',
    label: 'Open findmydoc Docs',
    url: 'https://findmydoc.com/docs',
    newTab: true,
  },
  render: (args) => <CMSLink {...args} />,
}
