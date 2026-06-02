import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import type { ClinicRegistrationFunnelProps } from '@/components/templates/ClinicRegistrationFunnel'
import { cn } from '@/utilities/ui'
import { withViewportStory } from '../utils/viewportMatrix'

const getStoryRemountKey = (args: ClinicRegistrationFunnelProps) =>
  JSON.stringify({
    initialSelectedTreatmentCategoryIds: args.initialSelectedTreatmentCategoryIds,
    initialStep: args.initialStep,
    initialValues: args.initialValues,
    reviewSummary: args.reviewSummary,
    treatmentCategories: args.treatmentCategories,
    variant: args.variant,
  })

const meta = {
  title: 'Domain/ClinicRegistration/Templates/Clinic Registration Funnel',
  component: ClinicRegistrationFunnel,
  decorators: [
    (Story, context) => (
      <div
        className={cn(
          'w-full px-4 py-8 text-card-foreground sm:px-6 lg:px-10',
          context.args.variant === 'landing' ? 'bg-site-canvas' : 'bg-muted',
        )}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => <ClinicRegistrationFunnel key={getStoryRemountKey(args)} {...args} />,
  tags: ['autodocs', 'domain:clinic-registration', 'layer:template', 'status:experimental', 'used-in:shared'],
} satisfies Meta<typeof ClinicRegistrationFunnel>

export default meta

type Story = StoryObj<typeof ClinicRegistrationFunnel>

const storyReviewSummary = {
  clinicAddress: 'Main Street 124, 10115 Berlin',
  clinicWebsite: 'https://marien-hospital.example',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.example',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Medical Director',
}

const landingStoryReviewSummary = {
  clinicAddress: 'Main Street 124, 10115 Berlin',
  clinicWebsite: 'https://marien-hospital.example',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.example',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Medical Director',
}

const longStoryReviewSummary = {
  clinicAddress: 'Verylongclinicmainaddresswithoutspaces-Internationalization-Station-124-126, 10115 Berlin',
  clinicWebsite: 'https://very-long-clinic-domain-berlin.example/international-clinic-registration',
  clinicName: 'Clinic Center for International Reconstructive Specialist Treatments and Long-Term Care Berlin',
  contactEmail: 'martina.musterfrau.clinic-registration-owner@very-long-clinic-domain-berlin.example',
  contactName: 'Dr. Martina Elisabeth Musterfrau-Specialty Coordination',
  contactRole: 'Medical Director and Responsible Owner for International Clinic Registration',
}

const defaultStoryArgs = {
  initialSelectedTreatmentCategoryIds: ['dental'],
  onSubmit: async () => undefined,
  reviewSummary: storyReviewSummary,
}

const landingStoryArgs = {
  ...defaultStoryArgs,
  reviewSummary: landingStoryReviewSummary,
  variant: 'landing',
} satisfies ClinicRegistrationFunnelProps

export const Step1ClinicDetails: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 1,
  },
}

export const Step2TreatmentCategories: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 2,
  },
}

export const Step3Contact: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 3,
  },
}

export const Step1ValidationErrors: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /^continue$/i }))

    await expect(canvas.getByText('Please enter the clinic name.')).toBeInTheDocument()
    await expect(canvas.getByText('Please enter the website.')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Clinic name')).toHaveAttribute('aria-invalid', 'true')
    await expect(canvas.getByLabelText('Clinic name')).toHaveFocus()
  },
}

export const Step2ValidationErrors: Story = {
  args: {
    ...defaultStoryArgs,
    initialSelectedTreatmentCategoryIds: [],
    initialStep: 2,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /^continue$/i }))

    await expect(canvas.getByText('Please select at least one focus area.')).toBeInTheDocument()
    await expect(canvas.getByRole('group', { name: /select treatment categories/i })).toHaveFocus()
  },
}

export const Step3ValidationErrors: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /^submit request$/i }))

    await expect(canvas.getByText('Please enter the full name.')).toBeInTheDocument()
    await expect(canvas.getByText('Please enter the email address.')).toBeInTheDocument()
    await expect(canvas.getByText('Please select a position.')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Full name')).toHaveFocus()
  },
}

export const Step3ServerError: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 3,
    initialValues: {
      clinicName: 'Aurora Clinic Berlin',
      clinicWebsite: 'https://aurora-clinic.example',
      contactEmail: 'ada.lovelace@aurora-clinic.example',
      contactName: 'Dr. Ada Lovelace',
      contactRole: 'Clinic Management',
    },
    onSubmit: async () => {
      throw new Error('Clinic registration failed')
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /^submit request$/i }))

    await expect(await canvas.findByText('Clinic registration failed')).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: /your contact/i })).toBeInTheDocument()
  },
}

export const Step4ReviewConfirmation: Story = {
  args: {
    ...defaultStoryArgs,
    initialSelectedTreatmentCategoryIds: ['dental', 'hair-restoration'],
    initialStep: 4,
  },
}

export const Step4LongReviewSummary: Story = {
  args: {
    ...defaultStoryArgs,
    initialSelectedTreatmentCategoryIds: ['dental', 'hair-restoration', 'plastic-surgery'],
    initialStep: 4,
    reviewSummary: longStoryReviewSummary,
  },
}

export const LandingStep1ClinicDetails: Story = {
  args: {
    ...landingStoryArgs,
    initialStep: 1,
  },
}

export const LandingStep2FocusCategories: Story = {
  args: {
    ...landingStoryArgs,
    initialStep: 2,
  },
}

export const LandingStep3ContactError: Story = {
  args: {
    ...landingStoryArgs,
    initialStep: 3,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: /^submit request$/i }))

    await expect(canvas.getByText('Please enter the full name.')).toBeInTheDocument()
    await expect(canvas.getByText('Please enter the email address.')).toBeInTheDocument()
    await expect(canvas.getByText('Please select a position.')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Full name')).toHaveFocus()
  },
}

export const LandingStep4ReviewConfirmation: Story = {
  args: {
    ...landingStoryArgs,
    initialSelectedTreatmentCategoryIds: ['dental', 'hair-restoration'],
    initialStep: 4,
  },
}

export const InteractiveFunnel: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: /register your clinic/i })).toBeInTheDocument()
    await expect(canvas.getByText(/international patients/i)).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Clinic name'), 'Aurora Clinic Berlin')
    await userEvent.type(canvas.getByLabelText('Website'), 'https://aurora-clinic.example')
    await userEvent.click(canvas.getByRole('button', { name: /^continue$/i }))

    const treatmentCategoriesHeading = await canvas.findByRole('heading', { name: /choose focus areas/i })
    await expect(treatmentCategoriesHeading).toBeInTheDocument()
    await waitFor(() => expect(treatmentCategoriesHeading).toHaveFocus())
    await expect(canvas.getByText(/welcome to the network/i)).toBeInTheDocument()
    const treatmentCategoryGroup = canvas.getByRole('group', { name: /select treatment categories/i })
    await expect(treatmentCategoryGroup).toBeInTheDocument()
    await expect(treatmentCategoryGroup).toHaveAccessibleDescription(/main categories for clinic search/i)
    for (const categoryLabel of ['Dental', 'Eye Care', 'Hair Restoration', 'Dermatology', 'Plastic Surgery']) {
      await expect(canvas.getByRole('button', { name: categoryLabel })).toBeInTheDocument()
    }
    await expect(canvas.queryByRole('button', { name: 'Body' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Kardio' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Allgemein' })).not.toBeInTheDocument()
    const hairCategoryButton = canvas.getByRole('button', { name: 'Hair Restoration' })
    hairCategoryButton.focus()
    await expect(hairCategoryButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(hairCategoryButton).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: /^continue$/i }))

    const contactHeading = await canvas.findByRole('heading', { name: /your contact/i })
    await expect(contactHeading).toBeInTheDocument()
    await waitFor(() => expect(contactHeading).toHaveFocus())
    await expect(canvas.getByText(/legitimate interest/i)).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Full name'), 'Dr. Ada Lovelace')
    await userEvent.type(canvas.getByLabelText('Email address'), 'ada.lovelace@aurora-clinic.example')
    await userEvent.selectOptions(canvas.getByLabelText('Position / role'), 'Clinic Management')
    await userEvent.click(canvas.getByRole('button', { name: /^submit request$/i }))

    const confirmationHeading = await canvas.findByRole('heading', { name: /request submitted/i })
    await expect(confirmationHeading).toBeInTheDocument()
    await waitFor(() => expect(confirmationHeading).toHaveFocus())
    await expect(canvas.getByText(/we will contact you once the review is complete/i)).toBeInTheDocument()
    await expect(canvas.getByText('Aurora Clinic Berlin')).toBeInTheDocument()
    await expect(canvas.getByText('https://aurora-clinic.example')).toBeInTheDocument()
    await expect(canvas.getByText('Dr. Ada Lovelace')).toBeInTheDocument()
    await expect(canvas.getByText(/Clinic Management/)).toBeInTheDocument()
    await expect(canvas.getByText(/ada.lovelace@aurora-clinic.example/)).toBeInTheDocument()
    await expect(canvas.getByText('Dental')).toBeInTheDocument()
    await expect(canvas.getByText('Hair Restoration')).toBeInTheDocument()
    await expect(canvas.queryByText(/dashboard/i)).not.toBeInTheDocument()
    await expect(canvas.queryByText(/complete your profile/i)).not.toBeInTheDocument()
    await expect(canvas.queryByText(/consent/i)).not.toBeInTheDocument()
  },
}

export const Responsive320: Story = withViewportStory(Step1ClinicDetails, 'public320', 'Responsive / 320')
export const Responsive375: Story = withViewportStory(Step1ClinicDetails, 'public375', 'Responsive / 375')
export const Responsive640: Story = withViewportStory(Step1ClinicDetails, 'public640', 'Responsive / 640')
export const Responsive768: Story = withViewportStory(Step1ClinicDetails, 'public768', 'Responsive / 768')
export const Responsive1024: Story = withViewportStory(Step1ClinicDetails, 'public1024', 'Responsive / 1024')
export const Responsive1280: Story = withViewportStory(Step1ClinicDetails, 'public1280', 'Responsive / 1280')
export const Responsive375Short: Story = withViewportStory(
  Step1ClinicDetails,
  'public375Short',
  'Responsive / 375 short',
)
export const Step3ValidationErrors375Short: Story = withViewportStory(
  Step3ValidationErrors,
  'public375Short',
  'Error State / Step 3 / 375 short',
)
export const Step4LongReviewSummary320Short: Story = withViewportStory(
  Step4LongReviewSummary,
  'public320Short',
  'Edge Case / Step 4 Long Review / 320 short',
)

export const LandingResponsive320: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public320',
  'Landing Responsive / 320',
)
export const LandingResponsive375: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public375',
  'Landing Responsive / 375',
)
export const LandingResponsive640: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public640',
  'Landing Responsive / 640',
)
export const LandingResponsive768: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public768',
  'Landing Responsive / 768',
)
export const LandingResponsive1024: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public1024',
  'Landing Responsive / 1024',
)
export const LandingResponsive1280: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public1280',
  'Landing Responsive / 1280',
)
export const LandingResponsive375Short: Story = withViewportStory(
  LandingStep1ClinicDetails,
  'public375Short',
  'Landing Responsive / 375 short',
)
export const LandingStep3ContactError375Short: Story = withViewportStory(
  LandingStep3ContactError,
  'public375Short',
  'Landing Error State / Step 3 / 375 short',
)
