import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { userEvent, within } from '@storybook/testing-library'
import { ClinicSearchBar } from '@/components/molecules/ClinicSearchBar'

const meta: Meta<typeof ClinicSearchBar> = {
  title: 'Molecules/ClinicSearchBar',
  component: ClinicSearchBar,
  tags: ['autodocs'],
  argTypes: {
    onSearch: { action: 'onSearch' },
  },
}

export default meta
type Story = StoryObj<typeof ClinicSearchBar>

const defaultServiceOptions = [
  { label: 'Nose Job', value: 'nose-job' },
  { label: 'Hair Transplant', value: 'hair-transplant' },
  { label: 'Teeth Whitening', value: 'teeth-whitening' },
  { label: 'LASIK', value: 'lasik' },
]

const defaultLocationOptions = [
  { label: 'Istanbul', value: 'istanbul' },
  { label: 'Antalya', value: 'antalya' },
  { label: 'Izmir', value: 'izmir' },
  { label: 'Ankara', value: 'ankara' },
]

export const Default: Story = {
  args: {
    serviceOptions: defaultServiceOptions,
    locationOptions: defaultLocationOptions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Find my Doctor!' })

    await expect(button).toBeInTheDocument()
    await expect(button).toHaveTextContent('Find my Doctor!')
    await expect(button.className).toContain('text-primary-foreground')

    await userEvent.hover(button)
    await expect(button).toHaveTextContent('Find my Doctor!')
    await expect(button.className).toContain('text-primary-foreground')
  },
}

export const WithDefaultValues: Story = {
  args: {
    serviceOptions: defaultServiceOptions,
    locationOptions: defaultLocationOptions,
    defaultServiceValue: 'hair-transplant',
    defaultLocationValue: 'istanbul',
    defaultBudget: '5000',
  },
}

export const EmptyOptions: Story = {
  args: {
    serviceOptions: [],
    locationOptions: [],
  },
}
