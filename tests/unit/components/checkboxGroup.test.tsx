// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CheckboxGroup } from '@/components/molecules/CheckboxGroup'

describe('CheckboxGroup', () => {
  it('renders disabled options as disabled and ignores click events', () => {
    const onValueChange = vi.fn()

    render(
      <CheckboxGroup
        label="City"
        options={[
          { label: 'Istanbul (1)', value: 'istanbul' },
          { label: 'Berlin (0)', value: 'berlin', disabled: true },
        ]}
        value={[]}
        onValueChange={onValueChange}
      />,
    )

    const istanbul = screen.getByRole('checkbox', { name: 'Istanbul (1)' })
    const berlin = screen.getByRole('checkbox', { name: 'Berlin (0)' })

    expect(berlin).toBeDisabled()
    fireEvent.click(berlin)
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.click(istanbul)
    expect(onValueChange).toHaveBeenCalledWith(['istanbul'])
  })
})
