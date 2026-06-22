// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DisclaimerNotice } from '@/components/molecules/DisclaimerNotice'

describe('DisclaimerNotice', () => {
  const copy = 'Clinic profile details are provided by the clinic unless otherwise noted.'

  it('renders route note copy without internal design guidance by default', () => {
    render(<DisclaimerNotice routeLabel="Clinic profiles" copy={copy} variant="inline-note" size="compact" />)

    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(screen.getByText('Clinic profiles')).toBeInTheDocument()
    expect(screen.queryByText('Inline note')).not.toBeInTheDocument()
    expect(screen.queryByText(/Visible in flow/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Still visible/i)).not.toBeInTheDocument()
  })

  it('keeps standalone route notes to icon and copy only', () => {
    render(<DisclaimerNotice routeLabel="Clinic profiles" copy={copy} variant="inline-note" standalone={true} />)

    expect(screen.getByText(copy)).toBeInTheDocument()
    expect(screen.queryByText('Clinic profiles')).not.toBeInTheDocument()
  })

  it('keeps collapsible disclosure text hidden until expanded', () => {
    render(<DisclaimerNotice routeLabel="Clinic profiles" copy={copy} variant="collapsible-disclosure" />)

    expect(screen.queryByText(copy)).not.toBeInTheDocument()
    expect(screen.queryByText(/Short legal text/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clinic profiles' }))

    expect(screen.getByText(copy)).toBeInTheDocument()
  })
})
