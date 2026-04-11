// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import useClickableCard from '@/utilities/useClickableCard'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

function ClickableCardHarness() {
  const { cardRef, linkRef } = useClickableCard<HTMLDivElement>({
    external: false,
  })

  return (
    <div data-testid="card" ref={cardRef}>
      <a href="/target" ref={linkRef}>
        Open target
      </a>
    </div>
  )
}

describe('useClickableCard', () => {
  beforeEach(() => {
    pushMock.mockReset()
  })

  it('navigates with left click on the card', () => {
    render(<ClickableCardHarness />)

    const card = screen.getByTestId('card')

    fireEvent.mouseDown(card, { button: 0 })
    fireEvent.mouseUp(card, { button: 0 })

    expect(pushMock).toHaveBeenCalledWith('http://localhost/target', { scroll: true })
  })

  it('does not intercept meta key card clicks', () => {
    render(<ClickableCardHarness />)

    const card = screen.getByTestId('card')

    fireEvent.mouseDown(card, { button: 0 })
    fireEvent.mouseUp(card, { button: 0, metaKey: true })

    expect(pushMock).not.toHaveBeenCalled()
  })
})
