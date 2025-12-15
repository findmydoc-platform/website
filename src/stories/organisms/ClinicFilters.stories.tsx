import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { expect } from '@storybook/jest'

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
      <div className="p-6">
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
        <pre data-testid="treatments-values" className="mt-4 text-xs text-muted-foreground">
          {JSON.stringify(treatments)}
        </pre>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const getTreatments = () => {
      const raw = canvas.getByTestId('treatments-values').textContent || '[]'
      return JSON.parse(raw) as string[]
    }

    // Initial state: no treatments selected
    expect(getTreatments()).toEqual([])

    const hip = canvas.getByRole('checkbox', { name: 'Hüftgelenk-OP' })
    const knee = canvas.getByRole('checkbox', { name: 'Kniegelenk-OP' })

    // Select a single treatment
    await userEvent.click(hip)
    expect(getTreatments()).toEqual(['Hüftgelenk-OP'])

    // Select an additional treatment
    await userEvent.click(knee)
    expect(getTreatments()).toEqual(expect.arrayContaining(['Hüftgelenk-OP', 'Kniegelenk-OP']))
    expect(getTreatments().length).toBe(2)

    // Deselect the first treatment
    await userEvent.click(hip)
    expect(getTreatments()).toEqual(['Kniegelenk-OP'])
  },
}
