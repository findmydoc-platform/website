import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResetPasswordRequestForm } from '@/app/(frontend)/auth/password/reset/ResetPasswordRequestForm'

// The client component expects React to be defined globally when rendered in isolation.
;(globalThis as unknown as { React: typeof React }).React = React

describe('ResetPasswordRequestForm', () => {
  it('posts to the password reset endpoint', () => {
    const html = renderToStaticMarkup(React.createElement(ResetPasswordRequestForm))
    expect(html).toContain('action="/api/auth/password/reset"')
    expect(html).toContain('method="post"')
  })
})
