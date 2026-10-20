// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/auth/utilities/loginHandler', () => ({ handleLogin: vi.fn() }))

afterEach(cleanup)

describe('Login form submission feedback', () => {
  it('announces rejected credentials when the page supplies a persistent Preview notice', async () => {
    render(
      <LoginForm.Root userTypes="platform" loginHandler={async () => ({ error: 'Invalid login credentials' })}>
        <LoginForm.Status message="This is a preview deployment. Please sign in to continue." />
        <LoginForm.Form>
          <LoginForm.EmailField />
          <LoginForm.PasswordField />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('This is a preview deployment.')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rejected@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rejected-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })
})
