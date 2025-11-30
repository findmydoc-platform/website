import type { Meta, StoryObj } from '@storybook/react'
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
  parameters: {
    layout: 'padded',
  },
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
}
