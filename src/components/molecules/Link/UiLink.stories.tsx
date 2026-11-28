import type { Meta, StoryObj } from '@storybook/react-vite'
import { UiLink } from '@/components/molecules/Link'

const meta = {
  title: 'Shared/Molecules/UiLink',
  component: UiLink,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
  argTypes: {
    appearance: {
      control: 'select',
      options: ['inline', 'default', 'primary', 'secondary', 'accent', 'link', 'outline'],
    },
    variant: {
      control: 'select',
      options: ['default', 'content', 'footer'],
    },
  },
} satisfies Meta<typeof UiLink>

export default meta
type Story = StoryObj<typeof meta>

export const Inline: Story = {
  args: {
    href: '/clinics',
  },
  render: (args) => (
    <p className="text-sm">
      Discover our <UiLink {...args}>clinic directory</UiLink> to compare treatments.
    </p>
  ),
}

export const ButtonVariant: Story = {
  args: {
    appearance: 'primary',
    label: 'Book consultation',
    href: '/book',
  },
  render: (args) => <UiLink {...args} />,
}

export const ExternalNewTab: Story = {
  args: {
    appearance: 'link',
    label: 'Open findmydoc Docs',
    href: 'https://findmydoc.com/docs',
    newTab: true,
  },
  render: (args) => <UiLink {...args} />,
}

export const FooterVariant: Story = {
  args: {
    appearance: 'inline',
    label: 'Privacy Policy',
    href: '/privacy',
    variant: 'footer',
  },
  render: (args) => (
    <div className="inline-flex flex-col items-start justify-end gap-6 pt-6 pr-20 pl-1.5">
      <p className="text-prominent text-foreground">Information</p>
      <ul className="space-y-1">
        <li>
          <UiLink {...args} />
        </li>
      </ul>
    </div>
  ),
}

export const ContentSurfaces: Story = {
  args: {
    href: '#example',
    variant: 'content',
  },
  render: (args) => (
    <div className="grid max-w-xl gap-4">
      <p className="bg-site-canvas p-4 text-foreground">
        Discover the <UiLink {...args}>clinic directory</UiLink> on the site canvas.
      </p>
      <p className="bg-accent p-4 text-accent-foreground" data-link-tone="accent">
        Discover the <UiLink {...args}>clinic directory</UiLink> on mint.
      </p>
      <p className="bg-secondary p-4 text-secondary-foreground" data-link-tone="inverse">
        Discover the <UiLink {...args}>clinic directory</UiLink> on navy.
      </p>
    </div>
  ),
}
