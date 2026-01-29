import type { Meta, StoryObj } from '@storybook/react-vite'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

const meta = {
  title: 'Molecules/SectionHeading',
  component: SectionHeading,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    title: 'Our Team',
    description: 'Meet the people building a better healthcare experience with findmydoc.',
    size: 'section',
    align: 'center',
    tone: 'default',
  },
  render: (args) => (
    <div className="bg-white py-20">
      <Container>
        <SectionHeading {...args} />
      </Container>
    </div>
  ),
} satisfies Meta<typeof SectionHeading>

export default meta

type Story = StoryObj<typeof meta>

export const Section: Story = {}

export const Hero: Story = {
  args: {
    title: 'Find the right clinic for you',
    description: 'Compare verified clinics, understand pricing, and connect with providers in a few clicks.',
    size: 'hero',
    headingAs: 'h1',
  },
}
