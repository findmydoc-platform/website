// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FAQSection } from '@/components/organisms/FAQ'

describe('FAQSection', () => {
  it('renders heading and description', () => {
    render(
      <FAQSection
        title="FAQ"
        description="Common questions."
        items={[{ id: 'q1', question: 'Question 1?', answer: 'Answer 1.' }]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.getByText('Common questions.')).toBeInTheDocument()
  })

  it('supports default open item and switching between items', () => {
    render(
      <FAQSection
        title="FAQ"
        defaultOpenItemId="q1"
        items={[
          { id: 'q1', question: 'Question 1?', answer: 'Answer 1.' },
          { id: 'q2', question: 'Question 2?', answer: 'Answer 2.' },
        ]}
      />,
    )

    expect(screen.getByText('Answer 1.')).toBeVisible()
    const answer2Initial = screen.queryByText('Answer 2.')
    if (answer2Initial) {
      expect(answer2Initial).not.toBeVisible()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Question 2?' }))

    const answer1After = screen.queryByText('Answer 1.')
    if (answer1After) {
      expect(answer1After).not.toBeVisible()
    }
    expect(screen.getByText('Answer 2.')).toBeVisible()
  })
})
