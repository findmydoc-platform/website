// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Link from 'next/link'

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
      <Link href="/target" ref={linkRef}>
        Open target
      </Link>
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

    const [href, options] = pushMock.mock.calls[0] ?? []
    expect(typeof href).toBe('string')
    expect(href).toMatch(/^http:\/\/localhost(?::\d+)?\/target$/)
    expect(options).toEqual({ scroll: true })
  })

  it('does not intercept meta key card clicks', () => {
    render(<ClickableCardHarness />)

    const card = screen.getByTestId('card')

    fireEvent.mouseDown(card, { button: 0 })
    fireEvent.mouseUp(card, { button: 0, metaKey: true })

    expect(pushMock).not.toHaveBeenCalled()
  })
})
