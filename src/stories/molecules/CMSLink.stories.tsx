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
    variant: {
      control: 'select',
      options: ['default', 'footer'],
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

export const FooterVariant: Story = {
  args: {
    appearance: 'inline',
    label: 'Privacy Policy',
    url: '/privacy',
    variant: 'footer',
  },
  render: (args) => (
    <div className="inline-flex flex-col justify-end items-start gap-6 pt-6 pr-20 pl-1.5">
      <p className="text-prominent text-foreground">Information</p>
      <ul className="space-y-1">
        <li>
          <CMSLink {...args} />
        </li>
      </ul>
    </div>
  ),
}
