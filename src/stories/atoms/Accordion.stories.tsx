import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/atoms/accordion'

const meta: Meta<typeof Accordion> = {
  title: 'Atoms/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
}

export default meta

type Story = StoryObj<typeof Accordion>

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <Accordion type="single" collapsible defaultValue="item-1" className="flex flex-col gap-4">
        <AccordionItem value="item-1">
          <AccordionTrigger>What is findmydoc?</AccordionTrigger>
          <AccordionContent>
            findmydoc connects patients with trusted clinics and specialists through a verified comparison platform.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How do clinics join?</AccordionTrigger>
          <AccordionContent>
            Clinics complete a profile, pass verification, and then appear in search results for relevant treatments.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Do patients pay to browse?</AccordionTrigger>
          <AccordionContent>Browsing is free. Patients contact clinics directly based on their needs.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByText(
        'findmydoc connects patients with trusted clinics and specialists through a verified comparison platform.',
      ),
    ).toBeInTheDocument()

    const secondTrigger = canvas.getByRole('button', { name: 'How do clinics join?' })
    await userEvent.click(secondTrigger)

    await expect(
      canvas.getByText(
        'Clinics complete a profile, pass verification, and then appear in search results for relevant treatments.',
      ),
    ).toBeInTheDocument()
  },
}
