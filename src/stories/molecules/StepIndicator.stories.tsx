import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { StepIndicator } from '@/components/molecules/StepIndicator'

const meta = {
  title: 'Shared/Molecules/StepIndicator',
  component: StepIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:experimental'],
  args: {
    currentStep: 2,
    statusLabel: '50% abgeschlossen',
    stepLabel: 'Schritt 2 von 4',
    totalSteps: 4,
  },
} satisfies Meta<typeof StepIndicator>

export default meta

type Story = StoryObj<typeof StepIndicator>

export const Default: Story = {
  render: (args) => (
    <div className="w-[min(480px,calc(100vw-32px))]">
      <StepIndicator {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const progress = canvas.getByRole('progressbar', { name: /schritt 2 von 4/i })

    await expect(progress).toHaveAttribute('aria-valuenow', '2')
    await expect(progress).toHaveAttribute('aria-valuemax', '4')
    await expect(progress).toHaveAttribute('aria-valuetext', 'Schritt 2 von 4')
    expect([...progress.querySelectorAll('[data-state]')].map((segment) => segment.getAttribute('data-state'))).toEqual(
      ['completed', 'current', 'upcoming', 'upcoming'],
    )
  },
}

export const Submitted: Story = {
  args: {
    ariaLabel: 'Klinikregistrierung, Schritt 4 von 4, Anfrage übermittelt',
    currentStep: 4,
    statusLabel: 'Anfrage übermittelt',
    stepLabel: 'Schritt 4 von 4',
    totalSteps: 4,
  },
  render: Default.render,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const progress = canvas.getByRole('progressbar', {
      name: 'Klinikregistrierung, Schritt 4 von 4, Anfrage übermittelt',
    })

    await expect(progress).toHaveAttribute('aria-valuetext', 'Schritt 4 von 4')
    expect([...progress.querySelectorAll('[data-state]')].map((segment) => segment.getAttribute('data-state'))).toEqual(
      ['completed', 'completed', 'completed', 'current'],
    )
  },
}
