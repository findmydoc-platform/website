import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { FAQSection } from '@/components/organisms/FAQ'
import { clinicPartnersFaqSection, homepageFaqSection } from '@/stories/fixtures/listings'
import { withViewportStory } from '@/stories/utils/viewportMatrix'

const meta: Meta<typeof FAQSection> = {
  title: 'Shared/Organisms/FAQSection',
  component: FAQSection,
  tags: ['autodocs', 'domain:shared', 'layer:organism', 'status:stable', 'used-in:block:faqsection'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Collapsible accordion section for frequently asked questions. Supports an optional default open item to control which question is expanded initially.',
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
    const firstAnswer = canvas.getByText(
      'By presenting clinic-provided information, contact options, and listed services in one structured comparison environment.',
    )
    await expect(firstAnswer).toBeInTheDocument()

    const q1 = canvas.getByRole('button', {
      name: 'How does this platform help clinics gain international patients?',
    })
    const q2 = canvas.getByRole('button', { name: 'Are the patient inquiries exclusive?' })
    await userEvent.click(q2)

    // After selecting another question: trigger state and answer content update
    await expect(q1).toHaveAttribute('aria-expanded', 'false')
    await expect(q2).toHaveAttribute('aria-expanded', 'true')
    await expect(
      canvas.getByText('Inquiries are handled according to your clinic profile settings and availability.'),
    ).toBeInTheDocument()
  },
}

export const ClinicPartners: Story = {
  args: {
    title: clinicPartnersFaqSection.title,
    description: clinicPartnersFaqSection.description,
    defaultOpenItemId: clinicPartnersFaqSection.defaultOpenItemId,
    items: clinicPartnersFaqSection.items,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const q1 = canvas.getByRole('button', {
      name: 'How does this platform help clinics gain international patients?',
    })
    const q2 = canvas.getByRole('button', { name: 'Are the patient inquiries exclusive?' })

    await expect(q1).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(q2)

    await expect(q1).toHaveAttribute('aria-expanded', 'false')
    await expect(q2).toHaveAttribute('aria-expanded', 'true')
    await expect(
      canvas.getByText('Patients contact clinics directly. There are no resold or recycled leads.'),
    ).toBeInTheDocument()
  },
}

export const Mobile320: Story = withViewportStory(Default, 'public320', 'FAQSection / 320')
export const Mobile375: Story = withViewportStory(Default, 'public375', 'FAQSection / 375')
export const Mobile640: Story = withViewportStory(Default, 'public640', 'FAQSection / 640')
export const Tablet768: Story = withViewportStory(Default, 'public768', 'FAQSection / 768')
export const Desktop1024: Story = withViewportStory(Default, 'public1024', 'FAQSection / 1024')
export const Desktop1280: Story = withViewportStory(Default, 'public1280', 'FAQSection / 1280')

export const ClinicPartners320: Story = withViewportStory(ClinicPartners, 'public320', 'Clinic partners FAQ / 320')
export const ClinicPartners375: Story = withViewportStory(ClinicPartners, 'public375', 'Clinic partners FAQ / 375')
export const ClinicPartners640: Story = withViewportStory(ClinicPartners, 'public640', 'Clinic partners FAQ / 640')
export const ClinicPartners768: Story = withViewportStory(ClinicPartners, 'public768', 'Clinic partners FAQ / 768')
export const ClinicPartners1024: Story = withViewportStory(ClinicPartners, 'public1024', 'Clinic partners FAQ / 1024')
export const ClinicPartners1280: Story = withViewportStory(ClinicPartners, 'public1280', 'Clinic partners FAQ / 1280')
