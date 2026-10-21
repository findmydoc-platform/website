import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import * as LoginForm from './LoginForm'
import { withMockRouter } from '@/stories/utils/routerDecorator'

const meta = {
  title: 'Domain/Auth/Organisms/LoginForm/Preview',
  component: LoginForm.Root,
  decorators: [withMockRouter],
  tags: ['autodocs', 'test', 'domain:auth', 'layer:organism', 'status:stable', 'used-in:route:/admin/login'],
  parameters: { layout: 'centered' },
  args: {
    userTypes: ['platform'],
    children: null,
    loginHandler: async () => ({ error: 'Invalid login credentials' }),
  },
} satisfies Meta<typeof LoginForm.Root>

export default meta
type Story = StoryObj<typeof meta>

export const RejectedCredentials: Story = {
  render: (args) => (
    <LoginForm.Root {...args}>
      <LoginForm.Header title="Platform Login" description="Access findmydoc platform tools" />
      <LoginForm.Status message="This is a preview deployment. Please sign in to continue." />
      <LoginForm.Form>
        <LoginForm.EmailField />
        <LoginForm.PasswordField />
        <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
      </LoginForm.Form>
    </LoginForm.Root>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('This is a preview deployment.')
    await userEvent.type(canvas.getByLabelText('Email'), 'rejected@example.com')
    await userEvent.type(canvas.getByLabelText('Password'), 'rejected-password')
    await userEvent.click(canvas.getByRole('button', { name: 'Sign in' }))
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    await expect(canvas.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  },
}
