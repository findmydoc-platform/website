import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'
import { Button } from '@/components/atoms/button'

const meta = {
  title: 'Shared/Atoms/Dialog',
  component: Dialog,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  parameters: {
    docs: {
      description: {
        component:
          'Modal dialog compound component for critical user interactions. Built with a Dialog root component and DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, sub-components for composable layouts.',
      },
    },
  },
} satisfies Meta<typeof Dialog>

export default meta
type Story = StoryObj<typeof meta>

const SampleDialog = () => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button ref={triggerRef} onClick={() => setOpen(true)}>
        Schedule call
      </Button>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          triggerRef.current?.focus()
        }}
      >
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const SampleConfirmationDialog = () => {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button ref={triggerRef} variant="destructive" onClick={() => setOpen(true)}>
        Delete record
      </Button>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          triggerRef.current?.focus()
        }}
      >
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
