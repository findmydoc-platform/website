import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'
import { Slider } from '@/components/atoms/slider'

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Slider>

export const Default: Story = {
  args: {
    value: [30],
    max: 100,
    step: 1,
  },
  render: (args) => {
    const [value, setValue] = React.useState(args.value ?? [0])
    return <Slider {...args} value={value} onValueChange={setValue} />
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
    value: [25, 75],
    max: 100,
    step: 1,
  },
  render: (args) => {
    const [value, setValue] = React.useState(args.value ?? [0, 0])
    return <Slider {...args} value={value} onValueChange={setValue} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const thumbs = canvas.getAllByRole('slider')
    if (thumbs.length < 2) {
      throw new Error('Expected range slider to render two thumbs')
    }
    const leftThumb = thumbs[0]!
    const rightThumb = thumbs[1]!

    leftThumb.focus()
    for (let i = 0; i < 80; i += 1) {
      await userEvent.keyboard('[ArrowRight]')
    }

    const leftValueAfter = Number(leftThumb.getAttribute('aria-valuenow'))
    const rightValueAfter = Number(rightThumb.getAttribute('aria-valuenow'))
    expect(leftValueAfter).toBeLessThanOrEqual(rightValueAfter)

    rightThumb.focus()
    for (let i = 0; i < 80; i += 1) {
      await userEvent.keyboard('[ArrowLeft]')
    }

    const leftValueFinal = Number(leftThumb.getAttribute('aria-valuenow'))
    const rightValueFinal = Number(rightThumb.getAttribute('aria-valuenow'))
    expect(rightValueFinal).toBeGreaterThanOrEqual(leftValueFinal)
  },
}

export const Disabled: Story = {
  args: {
    value: [40],
    max: 100,
    step: 1,
    disabled: true,
  },
  render: (args) => {
    const [value, setValue] = React.useState(args.value ?? [0])
    return <Slider {...args} value={value} onValueChange={setValue} />
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
    value: [15],
    min: 10,
    max: 90,
    step: 5,
  },
  render: (args) => {
    const [value, setValue] = React.useState(args.value ?? [0])
    return <Slider {...args} value={value} onValueChange={setValue} />
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
