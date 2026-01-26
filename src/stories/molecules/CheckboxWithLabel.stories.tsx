import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from '@storybook/test'

import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'

const meta: Meta<typeof CheckboxWithLabel> = {
  title: 'Molecules/CheckboxWithLabel',
  component: CheckboxWithLabel,
}

export default meta

type Story = StoryObj<typeof CheckboxWithLabel>

export const Default: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)

    return (
      <div className="space-y-2">
        <CheckboxWithLabel label="Option" checked={checked} onCheckedChange={setChecked} />
        <div data-testid="checked-state" className="text-xs text-muted-foreground">
          {checked ? 'checked' : 'unchecked'}
        </div>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole('checkbox', { name: 'Option' })
    const state = () => canvas.getByTestId('checked-state')

    // Initial state is unchecked
    expect(state()).toHaveTextContent('unchecked')

    // Toggle on
    await userEvent.click(checkbox)
    expect(state()).toHaveTextContent('checked')

    // Toggle off
    await userEvent.click(checkbox)
    expect(state()).toHaveTextContent('unchecked')
  },
}

export const Disabled: Story = {
  args: {
    label: 'Option',
    checked: true,
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkbox = canvas.getByRole('checkbox', { name: 'Option' })

    // Checkbox should be disabled and not respond to clicks
    expect(checkbox).toBeDisabled()
    await userEvent.click(checkbox)
  },
}
