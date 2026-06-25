import React from 'react'
import { describe, expect, it } from 'vitest'

import { ResetPasswordRequestForm } from '@/app/(frontend)/auth/password/reset/ResetPasswordRequestForm'
;(globalThis as unknown as { React: typeof React }).React = React

type ResetPasswordRequestFormElement = React.ReactElement<{
  reason?: 'expired' | null
}>

const isObjectRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function findResetPasswordRequestForm(node: React.ReactNode): ResetPasswordRequestFormElement | null {
  if (!React.isValidElement(node)) return null
  if (node.type === ResetPasswordRequestForm) return node as ResetPasswordRequestFormElement

  const children = isObjectRecord(node.props) ? node.props.children : undefined
  for (const child of React.Children.toArray(children as React.ReactNode)) {
    const result = findResetPasswordRequestForm(child)
    if (result) return result
  }

  return null
}

describe('ResetPasswordPage', () => {
  const getPage = async () => {
    const pageModule = await import('@/app/(frontend)/auth/password/reset/page')
    return pageModule.default
  }

  it('passes the expired reason to the reset request form', async () => {
    const ResetPasswordPage = await getPage()
    const result = await ResetPasswordPage({
      searchParams: Promise.resolve({
        reason: 'expired',
      }),
    })

    expect(findResetPasswordRequestForm(result)?.props.reason).toBe('expired')
  })

  it('ignores unknown reset reasons', async () => {
    const ResetPasswordPage = await getPage()
    const result = await ResetPasswordPage({
      searchParams: Promise.resolve({
        reason: 'show-email-for-user@example.com',
      }),
    })

    expect(findResetPasswordRequestForm(result)?.props.reason).toBeNull()
  })
})
