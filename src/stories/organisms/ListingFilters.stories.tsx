import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from '@storybook/test'

import { ListingFilters } from '@/components/organisms/Listing'
import { clinicFilterOptions } from '@/stories/fixtures'
import { withViewportStory } from '../utils/viewportMatrix'

const defaultCities = clinicFilterOptions.cities
const defaultWaitTimes = clinicFilterOptions.waitTimes.map((option) => option.label)
const defaultTreatments = clinicFilterOptions.treatments

const meta: Meta<typeof ListingFilters.Root> = {
  title: 'Domain/Listing/Organisms/ListingFilters',
  component: ListingFilters.Root,
  tags: ['autodocs', 'domain:listing', 'layer:organism', 'status:stable', 'used-in:block:listing-filters'],
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
        <ListingFilters.Root priceBounds={{ min: 0, max: 15000 }} defaultPriceRange={[0, 15000]}>
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

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
