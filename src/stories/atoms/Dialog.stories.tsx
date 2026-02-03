import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/atoms/dialog'
import { Button } from '@/components/atoms/button'

const meta = {
  title: 'Atoms/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Modal dialog compound component for critical user interactions. Built with a Dialog root component and DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, and DialogClose sub-components for composable layouts.',
      },
    },
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

const SampleDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button>Schedule call</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Book a consultation</DialogTitle>
        <DialogDescription>
          Share your contact details and we will coordinate a call with the clinic within 24 hours.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>• Live translator support available on request.</p>
        <p>• We confirm doctor availability before the call.</p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button>Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

const SampleConfirmationDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="destructive">Delete record</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete patient record</DialogTitle>
        <DialogDescription>
          This action is permanent. All appointment history and uploaded documents will be removed.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>• Only admins can restore data from backups.</p>
        <p>• Notify the care team before proceeding.</p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancel</Button>
        </DialogClose>
        <Button variant="destructive">Delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const Default: Story = {
  render: () => <SampleDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('button', { name: 'Schedule call' }))
    expect(body.getByRole('heading', { name: 'Book a consultation' })).toBeVisible()
    expect(
      body.getByText('Share your contact details and we will coordinate a call with the clinic within 24 hours.'),
    ).toBeVisible()

    await userEvent.click(body.getByRole('button', { name: 'Cancel' }))
    expect(body.queryByText('Book a consultation')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Schedule call' }))
    expect(body.getByRole('heading', { name: 'Book a consultation' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(body.queryByText('Book a consultation')).not.toBeInTheDocument()
  },
}

export const DestructiveConfirmation: Story = {
  render: () => <SampleConfirmationDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByRole('button', { name: 'Delete record' }))
    expect(body.getByRole('heading', { name: 'Delete patient record' })).toBeVisible()
    expect(
      body.getByText('This action is permanent. All appointment history and uploaded documents will be removed.'),
    ).toBeVisible()

    await userEvent.click(body.getByRole('button', { name: 'Cancel' }))
    expect(body.queryByText('Delete patient record')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Delete record' }))
    expect(body.getByRole('heading', { name: 'Delete patient record' })).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(body.queryByText('Delete patient record')).not.toBeInTheDocument()
  },
}
