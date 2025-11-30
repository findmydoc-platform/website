import type { Meta, StoryObj } from '@storybook/react'
import {
  Dialog,
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
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
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
        <Button variant="ghost">Cancel</Button>
        <Button>Confirm</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)

export const Default: Story = {
  render: () => <SampleDialog />,
}
