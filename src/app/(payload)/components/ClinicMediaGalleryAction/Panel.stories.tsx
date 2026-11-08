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
export const Unsaved: Story = { args: { dirty: true } }
export const Saving: Story = { args: { busy: true } }
export const Error: Story = { args: { error: 'An image needs alt text and the gallery must have room for it.' } }
