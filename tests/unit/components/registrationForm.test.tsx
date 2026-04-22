// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'

const registrationPassword = 'DemoPass123' // pragma: allowlist secret

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('RegistrationForm', () => {
  it('submits normalized form data and invokes success hooks', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onSuccess = vi.fn().mockResolvedValue(undefined)

    render(
      <RegistrationForm
        title="Create account"
        description="Register to continue."
        submitButtonText="Create account"
        fields={[
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', required: true },
          { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
        ]}
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'hello@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: registrationPassword } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: registrationPassword } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'hello@example.com',
        password: registrationPassword, // pragma: allowlist secret
      })
    })

    expect(onSuccess).toHaveBeenCalledWith({
      email: 'hello@example.com',
      password: registrationPassword, // pragma: allowlist secret
    })
    expect(screen.getByText('Your registration was submitted successfully.')).toBeInTheDocument()
  })
})
