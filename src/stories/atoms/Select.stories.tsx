import type { Meta, StoryObj } from '@storybook/react-vite'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { expect } from '@storybook/jest'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select'

const meta = {
  title: 'Atoms/Select',
  component: Select,
  tags: ['autodocs'],
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

const TreatmentSelect = () => (
  <Select defaultValue="cardiology">
    <SelectTrigger className="w-64">
      <SelectValue placeholder="Choose a specialty" />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        <SelectLabel>Popular Specialties</SelectLabel>
        <SelectItem value="cardiology">Cardiology</SelectItem>
        <SelectItem value="oncology">Oncology</SelectItem>
        <SelectItem value="orthopedics">Orthopedics</SelectItem>
        <SelectItem value="fertility">Fertility</SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
)

export const Default: Story = {
  render: () => <TreatmentSelect />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox')

    await userEvent.click(trigger)

    const cardiologyOption = body.getByRole('option', { name: 'Cardiology' })
    const orthopedicsOption = body.getByRole('option', { name: 'Orthopedics' })

    await waitFor(() => expect(cardiologyOption).toBeVisible())
    await waitFor(() => expect(orthopedicsOption).toBeVisible())

    await userEvent.click(orthopedicsOption)
    expect(trigger).toHaveTextContent('Orthopedics')
  },
}

export const WithoutDefaultValue: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="english">English</SelectItem>
          <SelectItem value="spanish">Spanish</SelectItem>
          <SelectItem value="french">French</SelectItem>
          <SelectItem value="arabic">Arabic</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const trigger = canvas.getByRole('combobox')

    expect(trigger).toHaveTextContent('Select language')

    await userEvent.click(trigger)

    const spanishOption = body.getByRole('option', { name: 'Spanish' })
    await waitFor(() => expect(spanishOption).toBeVisible())

    await userEvent.click(spanishOption)
    expect(trigger).toHaveTextContent('Spanish')
    expect(trigger).not.toHaveTextContent('Select language')
  },
}
