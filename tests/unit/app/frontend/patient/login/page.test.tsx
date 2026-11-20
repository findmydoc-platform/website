import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
;(globalThis as unknown as { React: typeof React }).React = React
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'de',
  getTranslations: async () => (key: string) => key,
}))

describe('Patient LoginPage', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'development',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

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

  const containsHref = (node: React.ReactNode, href: string): boolean => {
    if (!React.isValidElement(node)) return false
    if (isObjectRecord(node.props) && node.props.href === href) return true

    const children = isObjectRecord(node.props) ? node.props.children : undefined
    return React.Children.toArray(children as React.ReactNode).some((child) => containsHref(child, href))
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

  it.each(['//evil.example.com', '/login/patient', '/en/login/patient?locale=en'])(
    'falls back to home when next points to %s',
    async (next) => {
      const LoginPage = await getLoginPage()

      const result = await LoginPage({
        searchParams: Promise.resolve({ next }),
      })
      const loginRoot = findLoginRootElement(result)

      expect(loginRoot?.props.redirectPath).toBe('/')
    },
  )

  it('shows public registration in Preview', async () => {
    process.env.VERCEL_ENV = 'preview'
    const LoginPage = await getLoginPage()

    const result = await LoginPage({
      searchParams: Promise.resolve({
        next: '//evil.example.com',
      }),
    })
    const loginRoot = findLoginRootElement(result)

    expect(loginRoot?.props.redirectPath).toBe('/')
    expect(containsHref(result, '/register/patient')).toBe(true)
  })
})
