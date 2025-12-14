import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { ClinicFilters } from '@/components/organisms/ClinicFilters'

const defaultCities = ['Berlin', 'München', 'Hamburg', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf']
const defaultWaitTimes = ['Bis 1 Woche', 'Bis 2 Wochen', 'Bis 4 Wochen', 'Über 4 Wochen']
const defaultTreatments = ['Hüftgelenk-OP', 'Kniegelenk-OP', 'Grauer Star OP', 'Zahnimplantat', 'Lasik Augen-OP']

const meta: Meta<typeof ClinicFilters.Root> = {
  title: 'Organisms/ClinicFilters',
  component: ClinicFilters.Root,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof ClinicFilters.Root>

export const Default: Story = {
  render: () => {
    const [cities, setCities] = useState<string[]>([])
    const [waitTimes, setWaitTimes] = useState<string[]>([])
    const [treatments, setTreatments] = useState<string[]>([])

    return (
      <ClinicFilters.Root>
        <ClinicFilters.Price />
        <ClinicFilters.CheckboxGroup label="Stadt" options={defaultCities} value={cities} onValueChange={setCities} />
        <ClinicFilters.CheckboxGroup
          label="Wartezeit"
          options={defaultWaitTimes}
          value={waitTimes}
          onValueChange={setWaitTimes}
        />
        <ClinicFilters.CheckboxGroup
          label="Behandlungsart"
          options={defaultTreatments}
          value={treatments}
          onValueChange={setTreatments}
        />
        <ClinicFilters.Rating />
      </ClinicFilters.Root>
    )
  },
}
