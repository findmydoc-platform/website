// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from '@/components/molecules/Pagination'

describe('Pagination molecule', () => {
  it('navigates previous from page 2 to canonical /posts', () => {
    const onNavigate = vi.fn()

    render(<Pagination page={2} totalPages={5} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByLabelText('Go to previous page'))

    expect(onNavigate).toHaveBeenCalledWith('/posts')
  })

  it('navigates page 1 button to canonical /posts', () => {
    const onNavigate = vi.fn()

    render(<Pagination page={1} totalPages={3} onNavigate={onNavigate} />)

    fireEvent.click(screen.getByRole('button', { name: '1' }))

    expect(onNavigate).toHaveBeenCalledWith('/posts')
  })
})
