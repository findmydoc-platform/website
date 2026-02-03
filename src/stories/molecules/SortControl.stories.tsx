import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'
import * as React from 'react'

import { SortControl } from '@/components/molecules/SortControl'
import { SORT_OPTIONS, type SortOption } from '@/utilities/listingComparison/sort'

const meta = {
  title: 'Molecules/SortControl',
  component: SortControl,
  tags: ['autodocs'],
} satisfies Meta<typeof SortControl>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: 'Sort',
    options: SORT_OPTIONS,
    value: 'rank' satisfies SortOption,
    onValueChange: () => undefined,
  },
  render: (args) => {
    const initialValue = args.value ?? 'rank'
    const [value, setValue] = React.useState<SortOption>(initialValue)

    return <SortControl {...args} value={value} onValueChange={setValue} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox', { name: /sort/i })

    await userEvent.click(trigger)
    const priceOption = await body.findByRole('option', { name: /price: low to high/i })
    await userEvent.click(priceOption)

    expect(trigger).toHaveTextContent(/price: low to high/i)
  },
}
