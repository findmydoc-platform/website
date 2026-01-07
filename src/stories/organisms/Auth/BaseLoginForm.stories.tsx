import type { Meta, StoryObj } from '@storybook/react-vite'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { expect } from '@storybook/jest'
import { vi } from 'vitest'

import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import type { LoginResponse, LoginError, LoginRequest } from '@/components/organisms/Auth/types/loginTypes'
import { withMockRouter } from '../../utils/routerDecorator'
import Link from 'next/link'

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
  title: 'Organisms/Auth/LoginForm',
  component: LoginForm.Root,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test'],
  args: {
    userTypes: ['platform'],
  },
} satisfies Meta<typeof LoginForm.Root>

export default meta

type Story = StoryObj<typeof meta>

export const PlatformLogin: Story = {
  args: {
    loginHandler: mockSuccessHandler,
    children: null, // Satisfy required prop
  },
  render: (args) => (
    <LoginForm.Root {...args}>
      <LoginForm.Header title="Platform Login" description="Access findmydoc platform tools" />
      <LoginForm.Form>
        <LoginForm.EmailField />
        <LoginForm.PasswordField />
        <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
      </LoginForm.Form>
      <LoginForm.Footer>
        <p className="text-muted-foreground text-sm">
          Need an invite?{' '}
          <Link href="/register/platform" className="text-primary hover:underline">
            Register here
          </Link>
        </p>
        <p className="text-muted-foreground text-sm">
          <Link href="/" className="text-primary hover:underline">
            ← Back to marketing site
          </Link>
        </p>
      </LoginForm.Footer>
    </LoginForm.Root>
  ),
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
    children: null, // Satisfy required prop
  },
  render: (args) => (
    <LoginForm.Root {...args}>
      <LoginForm.Header title="Platform Login" description="Access findmydoc platform tools" />
      <LoginForm.Status message="Clinic staff approvals can take up to 48 hours." variant="info" />
      <LoginForm.Form>
        <LoginForm.EmailField />
        <LoginForm.PasswordField />
        <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
      </LoginForm.Form>
    </LoginForm.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByLabelText(/email/i), 'clinic@findmydoc.com')
    await userEvent.type(canvas.getByLabelText(/password/i), 'short')

    // Suppress expected login error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(canvas.getByText(/please use at least 8 characters/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  },
}

export const MaintenanceBanner: Story = {
  args: {
    children: null, // Satisfy required prop
  },
  render: (args) => (
    <LoginForm.Root {...args}>
      <LoginForm.Header title="Platform Login" description="Access findmydoc platform tools" />
      <LoginForm.Status message="The platform will undergo maintenance at 02:00 UTC." variant="warning" />
      <LoginForm.Form>
        <LoginForm.EmailField />
        <LoginForm.PasswordField />
        <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
      </LoginForm.Form>
    </LoginForm.Root>
  ),
}
