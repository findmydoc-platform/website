import { describe, expect, it } from 'vitest'
import { cn } from '@/utilities/ui'

describe('cn custom typography merge contract', () => {
  it('keeps the last custom text-size utility', () => {
    expect(cn('text-size-40', 'text-size-56')).toBe('text-size-56')
  })

  it('keeps custom typography and text color utilities together', () => {
    expect(cn('text-size-56', 'text-foreground')).toBe('text-size-56 text-foreground')
  })

  it('resolves custom typography conflicts inside a responsive modifier', () => {
    expect(cn('sm:text-size-40', 'sm:text-size-72')).toBe('sm:text-size-72')
  })
})
