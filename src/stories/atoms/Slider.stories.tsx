import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { within, userEvent } from '@storybook/testing-library'
import { expect } from '@storybook/jest'
import { Slider } from '@/components/atoms/slider'

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
}

export default meta

type Story = StoryObj<typeof Slider>

export const Default: Story = {
  args: {
    defaultValue: [30],
    max: 100,
    step: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const thumb = canvas.getByRole('slider')
    const startValue = Number(thumb.getAttribute('aria-valuenow'))

    thumb.focus()
    await userEvent.keyboard('[ArrowRight]')

    const updatedValue = Number(thumb.getAttribute('aria-valuenow'))
    expect(updatedValue).toBeGreaterThan(startValue)
  },
}

export const Range: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    step: 1,
  },
}

export const Disabled: Story = {
  args: {
    defaultValue: [40],
    max: 100,
    step: 1,
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const thumb = canvas.getByRole('slider')
    const sliderRoot = thumb.closest('[data-orientation="horizontal"]') as HTMLElement

    expect(sliderRoot).toHaveAttribute('data-disabled')
    expect(thumb).toHaveAttribute('data-disabled')

    const startValue = Number(thumb.getAttribute('aria-valuenow'))
    thumb.focus()
    await userEvent.keyboard('[ArrowRight]')
    const updatedValue = Number(thumb.getAttribute('aria-valuenow'))

    expect(updatedValue).toBe(startValue)
  },
}

export const CustomStep: Story = {
  args: {
    defaultValue: [15],
    min: 10,
    max: 90,
    step: 5,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const thumb = canvas.getByRole('slider')

    expect(thumb).toHaveAttribute('aria-valuemin', '10')
    expect(thumb).toHaveAttribute('aria-valuemax', '90')

    const startValue = Number(thumb.getAttribute('aria-valuenow'))
    expect(startValue % 5).toBe(0)

    thumb.focus()
    await userEvent.keyboard('[ArrowRight]')

    const updatedValue = Number(thumb.getAttribute('aria-valuenow'))
    expect(updatedValue).toBe(startValue + 5)
  },
}
