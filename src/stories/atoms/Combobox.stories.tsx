import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { Combobox, type ComboboxOption } from '@/components/atoms/combobox'

const options: ComboboxOption[] = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'Todo', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Done', value: 'done' },
  { label: 'Canceled', value: 'canceled' },
]

type ComboboxPreviewProps = {
  defaultValue: string
}

const ComboboxPreview: React.FC<ComboboxPreviewProps> = ({ defaultValue }) => {
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  return (
    <div>
      <Combobox
        options={options}
        value={value}
        onValueChange={setValue}
        placeholder="Select status"
        searchPlaceholder="Search status..."
      />
      <div className="mt-2 text-xs text-muted-foreground">Selected: {value || '(none)'}</div>
    </div>
  )
}

const meta = {
  title: 'Shared/Atoms/Combobox',
  component: ComboboxPreview,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  argTypes: {
    defaultValue: {
      control: 'select',
      options: ['', ...options.map((o) => o.value)],
    },
  },
  args: {
    defaultValue: '',
  },
} satisfies Meta<typeof ComboboxPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const documentScope = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox')

    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await userEvent.type(documentScope.getByPlaceholderText('Search status...'), 'done')
    await userEvent.click(documentScope.getByText('Done'))

    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveTextContent('Done')
    await expect(canvas.getByText('Selected: done')).toBeInTheDocument()
  },
}

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'in-progress',
  },
}
