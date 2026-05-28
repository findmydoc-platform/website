import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/ClinicRegistration/Templates/Clinic Registration Funnel',
  component: ClinicRegistrationFunnel,
  decorators: [
    (Story) => (
      <div className="w-full bg-muted px-4 py-8 text-card-foreground sm:px-6 lg:px-10">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:clinic-registration', 'layer:template', 'status:experimental', 'used-in:shared'],
} satisfies Meta<typeof ClinicRegistrationFunnel>

export default meta

type Story = StoryObj<typeof ClinicRegistrationFunnel>

const storyReviewSummary = {
  clinicAddress: 'Hauptstraße 124, 10115 Berlin',
  clinicName: 'St. Marien Hospital',
  contactEmail: 'm.musterfrau@marien-hospital.de',
  contactName: 'Dr. Martina Musterfrau',
  contactRole: 'Leitende Oberärztin',
}

const longStoryReviewSummary = {
  clinicAddress: 'Sehrlangeklinikhauptadresseohneleerzeichen-Station-Internationalisierung-124-126, 10115 Berlin',
  clinicName: 'Klinikzentrum fuer internationale rekonstruktive Spezialbehandlungen und Langzeitversorgung Berlin',
  contactEmail: 'martina.musterfrau.verantwortliche.klinikregistrierung@sehrlange-klinik-domain-berlin.example',
  contactName: 'Dr. Martina Elisabeth Musterfrau-Schwerpunktkoordination',
  contactRole: 'Leitende Oberaerztin und Verantwortliche fuer internationale Klinikregistrierung',
}

const defaultStoryArgs = {
  initialSelectedTreatmentCategoryIds: ['dental'],
  reviewSummary: storyReviewSummary,
}

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

export const InteractiveFunnel: Story = {
  args: {
    ...defaultStoryArgs,
    initialStep: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: /klinik registrieren/i })).toBeInTheDocument()
    await expect(canvas.getByText(/klinik international sichtbar machen/i)).toBeInTheDocument()
    await expect(canvas.queryByText(/international patients/i)).not.toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Klinikname'), 'St. Marien Hospital')
    await userEvent.click(canvas.getByRole('button', { name: /^weiter$/i }))

    const treatmentCategoriesHeading = await canvas.findByRole('heading', { name: /schwerpunkte wählen/i })
    await expect(treatmentCategoriesHeading).toBeInTheDocument()
    await waitFor(() => expect(treatmentCategoriesHeading).toHaveFocus())
    await expect(canvas.getByText(/schwerpunkte der klinik/i)).toBeInTheDocument()
    const treatmentCategoryGroup = canvas.getByRole('group', { name: /behandlungskategorien auswählen/i })
    await expect(treatmentCategoryGroup).toBeInTheDocument()
    await expect(treatmentCategoryGroup).toHaveAccessibleDescription(/hauptkategorien für die kliniksuche/i)
    for (const categoryLabel of ['Dental', 'Eye Care', 'Hair Restoration', 'Dermatology', 'Plastic Surgery']) {
      await expect(canvas.getByRole('button', { name: categoryLabel })).toBeInTheDocument()
    }
    await expect(canvas.queryByRole('button', { name: 'Body' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Kardio' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Allgemein' })).not.toBeInTheDocument()
    await expect(canvas.queryByText(/profil/i)).not.toBeInTheDocument()
    const hairCategoryButton = canvas.getByRole('button', { name: 'Hair Restoration' })
    hairCategoryButton.focus()
    await expect(hairCategoryButton).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect(hairCategoryButton).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(canvas.getByRole('button', { name: /^weiter$/i }))

    const contactHeading = await canvas.findByRole('heading', { name: /ihr kontakt/i })
    await expect(contactHeading).toBeInTheDocument()
    await waitFor(() => expect(contactHeading).toHaveFocus())
    await expect(canvas.getByText(/berechtigten interesse zur klinikregistrierung/i)).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText('Vollständiger Name'), 'Dr. Martina Musterfrau')
    await userEvent.click(canvas.getByRole('button', { name: /^anfrage senden$/i }))

    const confirmationHeading = await canvas.findByRole('heading', { name: /anfrage übermittelt/i })
    await expect(confirmationHeading).toBeInTheDocument()
    await waitFor(() => expect(confirmationHeading).toHaveFocus())
    await expect(canvas.getByText(/wir kontaktieren sie, sobald die prüfung abgeschlossen ist/i)).toBeInTheDocument()
    await expect(canvas.getByText('Dental')).toBeInTheDocument()
    await expect(canvas.getByText('Hair Restoration')).toBeInTheDocument()
    await expect(canvas.queryByText(/dashboard/i)).not.toBeInTheDocument()
    await expect(canvas.queryByText(/profil vervollständigen/i)).not.toBeInTheDocument()
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
export const Step4LongReviewSummary320Short: Story = withViewportStory(
  Step4LongReviewSummary,
  'public320Short',
  'Edge Case / Step 4 Long Review / 320 short',
)
