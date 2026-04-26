import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import { vi } from 'vitest'

import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import type { LoginResponse, LoginError, LoginRequest } from '@/components/organisms/Auth/types/loginTypes'
import { withMockRouter } from '../../utils/routerDecorator'
import Link from 'next/link'
import { withViewportStory } from '../../utils/viewportMatrix'

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
  title: 'Domain/Auth/Organisms/LoginForm',
  component: LoginForm.Root,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs', 'test', 'domain:auth', 'layer:organism', 'status:stable', 'used-in:block:login-form'],
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
        <p className="text-sm text-muted-foreground">
          Need an invite?{' '}
          <Link href="/register/platform" className="text-primary hover:underline">
            Register here
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
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

const mobileDenseStateBase: Story = {
  args: {
    loginHandler: mockInvalidCredentials,
    children: null,
  },
  render: (args) => (
    <LoginForm.Root {...args}>
      <LoginForm.Header
        title="Patient Login"
        description="Sign in to your patient account to access your clinic messages and saved treatment comparisons."
      />
      <LoginForm.Status
        message="Your clinic verification link expired. Request a new link and complete the sign-in flow again from the same device."
        variant="warning"
      />
      <LoginForm.Form>
        <LoginForm.EmailField placeholder="patient@example.com" />
        <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
        <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
      </LoginForm.Form>
      <LoginForm.Footer>
        <p className="text-sm text-muted-foreground">
          Need help signing in from a new phone?{' '}
          <Link href="/support/account" className="text-primary hover:underline">
            Read the account recovery guide
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            ← Back to the public homepage
          </Link>
        </p>
      </LoginForm.Footer>
    </LoginForm.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.type(canvas.getByLabelText(/email/i), 'patient@example.com')
    await userEvent.type(canvas.getByLabelText(/^password$/i), 'short')

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(canvas.getByText(/please use at least 8 characters/i)).toBeInTheDocument()
    })

    consoleSpy.mockRestore()
  },
}

export const MobileDense320: Story = withViewportStory(mobileDenseStateBase, 'public320', 'Mobile dense / 320')
export const MobileDense375: Story = withViewportStory(mobileDenseStateBase, 'public375', 'Mobile dense / 375')
export const MobileDense640: Story = withViewportStory(mobileDenseStateBase, 'public640', 'Mobile dense / 640')
export const MobileDense768: Story = withViewportStory(mobileDenseStateBase, 'public768', 'Mobile dense / 768')
export const MobileDense1024: Story = withViewportStory(mobileDenseStateBase, 'public1024', 'Mobile dense / 1024')
export const MobileDense1280: Story = withViewportStory(mobileDenseStateBase, 'public1280', 'Mobile dense / 1280')
export const MobileDense375Short: Story = withViewportStory(
  mobileDenseStateBase,
  'public375Short',
  'Mobile dense / 375 short',
)
