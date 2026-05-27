import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, spyOn, userEvent, waitFor, within } from 'storybook/test'

import { ClinicRegistrationForm } from '@/components/organisms/Auth/ClinicRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'
import { withViewportStory } from '../../utils/viewportMatrix'

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))
const cityOptions = [
  { id: '10', name: 'Istanbul' },
  { id: '11', name: 'Ankara' },
  { id: '12', name: 'Izmir' },
  { id: '13', name: 'Antalya' },
  { id: '14', name: 'Bursa' },
]

const rejectClinicRegistration = async () => {
  await delay()
  throw new Error('Please review clinic details before submitting.')
}

const submitClinicRegistration = async () => {
  await delay()
}

const meta = {
  title: 'Domain/Auth/Organisms/ClinicRegistrationForm',
  component: ClinicRegistrationForm,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: [
    'autodocs',
    'test',
    'domain:auth',
    'layer:organism',
    'status:stable',
    'used-in:block:clinic-registration-form',
  ],
} satisfies Meta<typeof ClinicRegistrationForm>

export default meta

type Story = StoryObj<typeof ClinicRegistrationForm>

export const Default: Story = {
  args: {
    onSubmit: rejectClinicRegistration,
    cityOptions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const documentScope = within(canvasElement.ownerDocument.body)

    await userEvent.type(canvas.getByLabelText(/clinic name/i), 'Bright Smiles Clinic')
    await userEvent.type(canvas.getByLabelText(/website or public profile/i), 'brightsmiles.example')
    await userEvent.type(canvas.getByLabelText('First Name'), 'Jordan')
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Lee')
    await userEvent.type(canvas.getByLabelText(/street/i), 'Main Street')
    await userEvent.type(canvas.getByLabelText(/house number/i), '12A')
    await userEvent.type(canvas.getByLabelText(/postal code/i), '10115')
    await userEvent.click(canvas.getByRole('combobox', { name: /city/i }))
    await userEvent.type(documentScope.getByPlaceholderText(/search city/i), 'istanbul')
    await userEvent.click(documentScope.getByText('Istanbul'))
    await expect(canvas.getByText('Turkey')).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText(/email/i), 'clinic@findmydoc.com')

    const consoleSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await userEvent.click(canvas.getByRole('button', { name: /submit registration/i }))

      await waitFor(() => {
        expect(canvas.getByText(/please review clinic details/i)).toBeInTheDocument()
      })
    } finally {
      consoleSpy.mockRestore()
    }
  },
}

export const SuccessfulSubmission: Story = {
  args: {
    onSubmit: submitClinicRegistration,
    cityOptions,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/clinic name/i), 'Bright Smiles Clinic')
    await userEvent.type(canvas.getByLabelText(/website or public profile/i), 'brightsmiles.example')
    await userEvent.type(canvas.getByLabelText('First Name'), 'Jordan')
    await userEvent.type(canvas.getByLabelText('Last Name'), 'Lee')
    await userEvent.type(canvas.getByLabelText(/street/i), 'Main Street')
    await userEvent.type(canvas.getByLabelText(/house number/i), '12A')
    await userEvent.type(canvas.getByLabelText(/postal code/i), '10115')
    await userEvent.click(canvas.getByRole('checkbox', { name: /my city is not listed/i }))
    await userEvent.type(canvas.getByRole('textbox', { name: 'City' }), 'Mersin')
    await expect(canvas.getByText('Turkey')).toBeInTheDocument()
    await userEvent.type(canvas.getByLabelText(/email/i), 'clinic@findmydoc.com')

    await userEvent.click(canvas.getByRole('button', { name: /submit registration/i }))

    await waitFor(() => {
      expect(canvas.getByText(/submitted\. we will review it/i)).toBeInTheDocument()
    })
  },
}

const validationViewportBase: Story = {
  args: Default.args,
  decorators: Default.decorators,
  play: Default.play,
}

const successViewportBase: Story = {
  args: SuccessfulSubmission.args,
  decorators: SuccessfulSubmission.decorators,
  play: SuccessfulSubmission.play,
}

export const Validation320: Story = withViewportStory(validationViewportBase, 'public320', 'Validation / 320')
export const Validation375: Story = withViewportStory(validationViewportBase, 'public375', 'Validation / 375')
export const Validation640: Story = withViewportStory(validationViewportBase, 'public640', 'Validation / 640')
export const Validation768: Story = withViewportStory(validationViewportBase, 'public768', 'Validation / 768')
export const Validation1024: Story = withViewportStory(validationViewportBase, 'public1024', 'Validation / 1024')
export const Validation1280: Story = withViewportStory(validationViewportBase, 'public1280', 'Validation / 1280')
export const Validation375Short: Story = withViewportStory(
  validationViewportBase,
  'public375Short',
  'Validation / 375 short',
)

export const Success320: Story = withViewportStory(successViewportBase, 'public320', 'Success / 320')
export const Success375: Story = withViewportStory(successViewportBase, 'public375', 'Success / 375')
export const Success640: Story = withViewportStory(successViewportBase, 'public640', 'Success / 640')
export const Success768: Story = withViewportStory(successViewportBase, 'public768', 'Success / 768')
export const Success1024: Story = withViewportStory(successViewportBase, 'public1024', 'Success / 1024')
export const Success1280: Story = withViewportStory(successViewportBase, 'public1280', 'Success / 1280')
export const Success375Short: Story = withViewportStory(successViewportBase, 'public375Short', 'Success / 375 short')
