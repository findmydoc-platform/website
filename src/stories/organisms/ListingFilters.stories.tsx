import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { within, userEvent } from '@storybook/testing-library'
import { expect } from '@storybook/jest'

import { ListingFilters } from '@/components/organisms/Listing'
import { clinicFilterOptions } from '@/stories/fixtures'

const defaultCities = clinicFilterOptions.cities
const defaultWaitTimes = clinicFilterOptions.waitTimes.map((option) => option.label)
const defaultTreatments = clinicFilterOptions.treatments

const meta: Meta<typeof ListingFilters.Root> = {
  title: 'Organisms/ListingFilters',
  component: ListingFilters.Root,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof ListingFilters.Root>

export const Default: Story = {
  render: () => {
    const [cities, setCities] = useState<string[]>([])
    const [waitTimes, setWaitTimes] = useState<string[]>([])
    const [treatments, setTreatments] = useState<string[]>([])

    return (
      <div className="p-6">
        <ListingFilters.Root>
          <ListingFilters.Price />
          <ListingFilters.CheckboxGroup label="City" options={defaultCities} value={cities} onValueChange={setCities} />
          <ListingFilters.CheckboxGroup
            label="Wait time"
            options={defaultWaitTimes}
            value={waitTimes}
            onValueChange={setWaitTimes}
          />
          <ListingFilters.CheckboxGroup
            label="Treatment"
            options={defaultTreatments}
            value={treatments}
            onValueChange={setTreatments}
          />
          <ListingFilters.Rating />
        </ListingFilters.Root>
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

    const hip = canvas.getByRole('checkbox', { name: 'Hip replacement' })
    const knee = canvas.getByRole('checkbox', { name: 'Knee replacement' })

    // Select a single treatment
    await userEvent.click(hip)
    expect(getTreatments()).toEqual(['Hip replacement'])

    // Select an additional treatment
    await userEvent.click(knee)
    expect(getTreatments()).toEqual(expect.arrayContaining(['Hip replacement', 'Knee replacement']))
    expect(getTreatments().length).toBe(2)

    // Deselect the first treatment
    await userEvent.click(hip)
    expect(getTreatments()).toEqual(['Knee replacement'])
  },
}
