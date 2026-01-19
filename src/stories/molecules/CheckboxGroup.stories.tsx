import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from '@storybook/test'

import { CheckboxGroup } from '@/components/molecules/CheckboxGroup'

const meta: Meta<typeof CheckboxGroup> = {
  title: 'Molecules/CheckboxGroup',
  component: CheckboxGroup,
}

export default meta

type Story = StoryObj<typeof CheckboxGroup>

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string[]>(['Deutsch'])

    return (
      <div className="space-y-2">
        <CheckboxGroup
          label="Sprachen"
          options={['Deutsch', 'Englisch', 'Spanisch']}
          value={value}
          onValueChange={setValue}
        />
        <pre data-testid="selected-values" className="text-muted-foreground text-xs">
          {JSON.stringify(value)}
        </pre>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const getSelected = () => {
      const raw = canvas.getByTestId('selected-values').textContent || '[]'
      return JSON.parse(raw) as string[]
    }

    // Initial state: only "Deutsch" is selected
    expect(getSelected()).toEqual(['Deutsch'])

    const deutsch = canvas.getByRole('checkbox', { name: 'Deutsch' })
    const englisch = canvas.getByRole('checkbox', { name: 'Englisch' })

    // Select an additional option
    await userEvent.click(englisch)
    expect(getSelected()).toEqual(expect.arrayContaining(['Deutsch', 'Englisch']))
    expect(getSelected().length).toBe(2)

    // Deselect the first option
    await userEvent.click(deutsch)
    expect(getSelected()).toEqual(['Englisch'])
  },
}

export const EmptyInitially: Story = {
  render: () => {
    const [value, setValue] = useState<string[]>([])

    return (
      <CheckboxGroup
        label="Sprachen"
        options={['Deutsch', 'Englisch', 'Spanisch']}
        value={value}
        onValueChange={setValue}
      />
    )
  },
}
