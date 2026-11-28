import type { Meta, StoryObj } from '@storybook/react-vite'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

const meta = {
  title: 'Shared/Molecules/SectionHeading',
  component: SectionHeading,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
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
    description: 'Compare clinic-provided information, understand listed price fields, and contact providers directly.',
    size: 'hero',
    headingAs: 'h1',
  },
}

export const Editorial: Story = {
  args: {
    title: 'Care options in Türkiye for patients travelling from abroad',
    description: 'Compare clinic information, learn what a price includes, and contact the clinic with your questions.',
    spacing: 'editorial',
    tone: 'brand',
  },
}
