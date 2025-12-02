import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { expect } from '@storybook/jest'

import { BaseLoginForm } from '@/components/organisms/Auth/BaseLoginForm'
import type { LoginResponse, LoginError, LoginRequest } from '@/components/organisms/Auth/types/loginTypes'
import { withMockRouter } from '../../utils/routerDecorator'

const mockSuccessHandler = async (_data: LoginRequest): Promise<LoginResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return {
    success: true,
    redirectUrl: '/dashboard',
    user: {
      id: 'user-1',
      email: 'platform-user@findmydoc.com',
      userType: 'platform',
    },
  }
}

const mockInvalidCredentials = async (_data: LoginRequest): Promise<LoginError> => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return {
    error: 'Invalid credentials',
    details: [
      {
        field: 'password',
        message: 'Please use at least 8 characters.',
      },
    ],
  }
}

const meta = {
  title: 'Organisms/Auth/BaseLoginForm',
  component: BaseLoginForm,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
  args: {
    title: 'Platform Login',
    description: 'Access findmydoc platform tools',
    userTypes: ['platform'],
    links: {
      register: { href: '/register/platform', text: 'Need an invite?' },
      home: { href: '/', text: '← Back to marketing site' },
    },
  },
} satisfies Meta<typeof BaseLoginForm>

export default meta

type Story = StoryObj<typeof meta>

export const PlatformLogin: Story = {
  args: {
    loginHandler: mockSuccessHandler,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/email/i), 'platform-user@findmydoc.com')
    await userEvent.type(canvas.getByLabelText(/password/i), 'super-secure-password')
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
    })
  },
}

export const InvalidCredentials: Story = {
  args: {
    loginHandler: mockInvalidCredentials,
    statusMessage: {
      text: 'Clinic staff approvals can take up to 48 hours.',
      variant: 'info',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/email/i), 'clinic@findmydoc.com')
    await userEvent.type(canvas.getByLabelText(/password/i), 'short')
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(canvas.getByText(/please use at least 8 characters/i)).toBeInTheDocument()
    })
  },
}

export const MaintenanceBanner: Story = {
  args: {
    statusMessage: {
      text: 'The platform will undergo maintenance at 02:00 UTC.',
      variant: 'warning',
    },
  },
}
