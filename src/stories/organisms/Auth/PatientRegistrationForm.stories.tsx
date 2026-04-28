import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { vi } from 'vitest'

import { PatientRegistrationForm } from '@/components/organisms/Auth/PatientRegistrationForm'
import { withMockRouter } from '../../utils/routerDecorator'
import { createDelayedJsonResponse } from '../../utils/mockHelpers'
import { createMockFetchDecorator } from '../../utils/fetchDecorator'
import { withViewportStory } from '../../utils/viewportMatrix'

const mockFetch: typeof fetch = async (input) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString()

  if (url.includes('/auth/v1/signup')) {
    return createDelayedJsonResponse({
      user: { id: 'patient-1', email: 'patient@findmydoc.com' },
      session: null,
    })
  }

  if (url.includes('/api/auth/register/patient/metadata')) {
    return createDelayedJsonResponse({ success: true })
  }

  if (url.includes('/api/auth/register/patient/cleanup')) {
    return createDelayedJsonResponse({ success: true })
  }

  return createDelayedJsonResponse({ success: true })
}

const meta = {
  title: 'Domain/Auth/Organisms/PatientRegistrationForm',
  component: PatientRegistrationForm,
  decorators: [
    withMockRouter,
    createMockFetchDecorator(mockFetch, () => {
      if (typeof process !== 'undefined') {
        process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'public-anon-key'
      }
    }),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: [
    'autodocs',
    'test',
    'domain:auth',
    'layer:organism',
    'status:stable',
    'used-in:block:patient-registration-form',
  ],
} satisfies Meta<typeof PatientRegistrationForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')

    // Suppress expected registration error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()

    await userEvent.clear(canvas.getByLabelText(/confirm password/i))
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')
    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /creating account/i })).toBeInTheDocument()
    })
  },
}

const validationViewportBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'Mismatch123')

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByText(/passwords do not match/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  },
}

const successViewportBase: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/first name/i), 'Jamie')
    await userEvent.type(canvas.getByLabelText(/last name/i), 'Quinn')
    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@findmydoc.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'SecurePass123')
    await userEvent.type(canvas.getByLabelText(/confirm password/i), 'SecurePass123')

    await userEvent.click(canvas.getByRole('button', { name: /create patient account/i }))

    await waitFor(() => {
      expect(canvas.getByText(/your registration was submitted successfully/i)).toBeInTheDocument()
    })
  },
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
