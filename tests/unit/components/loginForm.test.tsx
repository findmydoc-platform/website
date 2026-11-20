// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/auth/utilities/loginHandler', () => ({ handleLogin: vi.fn() }))

afterEach(cleanup)

describe('Login form submission feedback', () => {
  it('announces pending and rejected sign-in alongside the Preview notice', async () => {
    const notice = 'Synthetic Preview notice'
    const pendingMessage = 'Checking fixture credentials'
    const error = 'The fixture credentials were rejected'
    let resolveLogin!: (result: { error: string }) => void
    const loginResponse = new Promise<{ error: string }>((resolve) => {
      resolveLogin = resolve
    })
    render(
      <LoginForm.Root userTypes="platform" loginHandler={() => loginResponse}>
        <LoginForm.Status message={notice} />
        <LoginForm.Form>
          <LoginForm.EmailField />
          <LoginForm.PasswordField />
          <LoginForm.SubmitButton loadingText={pendingMessage}>Submit fixture credentials</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>,
    )

    expect(screen.getByText(notice)).toHaveRole('status')
    const submit = screen.getByRole('button', { name: 'Submit fixture credentials' })
    const form = submit.closest('form')!
    const status = within(form).getByRole('status')
    expect(status).toBeEmptyDOMElement()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rejected@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'rejected-password' } })
    fireEvent.click(submit)
    expect(status).toHaveTextContent(pendingMessage)
    expect(submit).toBeDisabled()
    resolveLogin({ error })

    expect(await screen.findByRole('alert')).toHaveTextContent(error)
    expect(status).toBeEmptyDOMElement()
    expect(submit).toBeEnabled()
  })
})
