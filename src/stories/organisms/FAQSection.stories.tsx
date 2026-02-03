import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { FAQSection } from '@/components/organisms/FAQ'
import { homepageFaqSection } from '@/stories/fixtures/listings'

const meta: Meta<typeof FAQSection> = {
  title: 'Organisms/FAQSection',
  component: FAQSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Collapsible accordion section for frequently asked questions. Supports optional default open item and includes interaction tests.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof FAQSection>

export const Default: Story = {
  args: {
    title: homepageFaqSection.title,
    description: homepageFaqSection.description,
    defaultOpenItemId: homepageFaqSection.defaultOpenItemId,
    items: homepageFaqSection.items,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Default: first answer visible
    await expect(
      canvas.getByText(
        'By combining global visibility, patient guidance, and quality-focused clinic presentation in one trusted comparison environment.',
      ),
    ).toBeInTheDocument()

    const q2 = canvas.getByRole('button', { name: 'Are the patient inquiries exclusive?' })
    await userEvent.click(q2)

    // After selecting another question: new answer visible
    await expect(
      canvas.getByText('Inquiries are handled according to your clinic profile settings and availability.'),
    ).toBeInTheDocument()
  },
}
