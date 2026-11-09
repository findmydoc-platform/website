import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ClinicMediaGalleryActionPanel } from './Panel'

const meta = {
  title: 'Domain/Clinics/Organisms/MediaGalleryAction',
  component: ClinicMediaGalleryActionPanel,
  parameters: { nextjs: { appDirectory: false } },
  tags: [
    'autodocs',
    'domain:clinics',
    'layer:organism',
    'status:stable',
    'used-in:route:/admin/collections/clinicMedia',
  ],
  args: { dirty: false, busy: false, onAdd: fn() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 600, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClinicMediaGalleryActionPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Add to clinic gallery' }))
    await expect(args.onAdd).toHaveBeenCalledOnce()
  },
}
export const Unsaved: Story = {
  args: { dirty: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Add to clinic gallery' })).toBeDisabled()
    await expect(canvas.getByText('Save or discard changes before adding this image.')).toBeVisible()
  },
}
export const Saving: Story = {
  args: { busy: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Adding image…' })).toBeDisabled()
    await expect(canvas.getByRole('status')).toHaveTextContent('Adding image to the clinic gallery…')
  },
}
export const Error: Story = {
  args: { error: 'An image needs alt text and the gallery must have room for it.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('alert')).toHaveTextContent(
      'An image needs alt text and the gallery must have room for it.',
    )
  },
}
export const Success: Story = {
  args: { status: 'Image added to the clinic gallery.' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveTextContent('Image added to the clinic gallery.')
  },
}
