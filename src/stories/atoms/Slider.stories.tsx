import type { Meta, StoryObj } from '@storybook/nextjs-vite'
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
}

export const Range: Story = {
  args: {
    defaultValue: [25, 75],
    max: 100,
    step: 1,
  },
}
