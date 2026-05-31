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

  it('renders compact pointer-enabled accordion triggers', () => {
    render(
      <FAQSection
        title="FAQ"
        description="Common questions."
        defaultOpenItemId="q1"
        items={[{ id: 'q1', question: 'Question 1?', answer: 'Answer 1.' }]}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Question 1?' })
    const icon = trigger.querySelector('svg')
    if (!icon) throw new Error('Expected FAQ trigger icon')

    expect(trigger).toHaveClass('cursor-pointer')
    expect(trigger).toHaveClass('bg-accent')
    expect(trigger).toHaveClass('text-accent-foreground')
    expect(trigger).toHaveClass('text-base')
    expect(trigger).toHaveClass('sm:text-lg')
    expect(trigger).not.toHaveClass('md:text-xl')
    expect(trigger).toHaveClass('focus-visible:ring-ring')
    expect(trigger).not.toHaveClass('before:bg-secondary')
    expect(trigger).not.toHaveClass('data-[state=open]:before:bg-secondary')
    expect(icon).toHaveClass('text-accent-foreground')
    expect(icon).toHaveClass('group-data-[state=open]:rotate-180')
    expect(screen.getByText('Answer 1.')).toHaveClass('text-foreground/80')
    expect(screen.getByText('Answer 1.')).toHaveClass('bg-white')
    expect(screen.getByText('Answer 1.')).toHaveClass('text-sm')
    expect(screen.getByText('Answer 1.')).toHaveClass('sm:text-base')
    expect(trigger.parentElement?.parentElement).toHaveClass('scroll-mb-24')
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

    const question1 = screen.getByRole('button', { name: 'Question 1?' })
    const question2 = screen.getByRole('button', { name: 'Question 2?' })

    fireEvent.click(question2)

    const answer1After = screen.queryByText('Answer 1.')
    if (answer1After) {
      expect(answer1After).not.toBeVisible()
    }
    expect(screen.getByText('Answer 2.')).toBeVisible()
    expect(question1).toHaveAttribute('aria-expanded', 'false')
    expect(question2).toHaveAttribute('aria-expanded', 'true')
  })
})
