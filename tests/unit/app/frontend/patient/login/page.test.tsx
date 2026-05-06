import React from 'react'
import { describe, expect, it } from 'vitest'
;(globalThis as unknown as { React: typeof React }).React = React

describe('Patient LoginPage', () => {
  type LoginRootElement = React.ReactElement<{ redirectPath: string; children: React.ReactNode }>

  const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

  const findLoginRootElement = (node: React.ReactNode): LoginRootElement | null => {
    if (!React.isValidElement(node)) return null
    if (isObjectRecord(node.props) && typeof node.props.redirectPath === 'string') return node as LoginRootElement

    const children = isObjectRecord(node.props) ? node.props.children : undefined
    for (const child of React.Children.toArray(children as React.ReactNode)) {
      const result = findLoginRootElement(child)
      if (result) return result
    }

    return null
  }

  const getLoginPage = async () => {
    const pageModule = await import('@/app/(frontend)/login/patient/page')
    return pageModule.default
  }

  it('passes a safe internal next path to LoginForm.Root', async () => {
    const LoginPage = await getLoginPage()

    const result = await LoginPage({
      searchParams: Promise.resolve({
        next: '/clinics/berlin-health-clinic?from=favorites',
      }),
    })
    const loginRoot = findLoginRootElement(result)

    expect(loginRoot?.props.redirectPath).toBe('/clinics/berlin-health-clinic?from=favorites')
  })

  it('falls back to home for unsafe next paths', async () => {
    const LoginPage = await getLoginPage()

    const result = await LoginPage({
      searchParams: Promise.resolve({
        next: '//evil.example.com',
      }),
    })
    const loginRoot = findLoginRootElement(result)

    expect(loginRoot?.props.redirectPath).toBe('/')
  })
})
