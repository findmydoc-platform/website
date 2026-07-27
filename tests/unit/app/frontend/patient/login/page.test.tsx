import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
;(globalThis as unknown as { React: typeof React }).React = React

import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'

const headersMock = vi.hoisted(() => vi.fn(async () => new Headers()))

vi.mock('next/headers', () => ({
  headers: headersMock,
}))

describe('Patient LoginPage', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: 'development',
    }
    headersMock.mockResolvedValue(new Headers())
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

  const containsText = (node: React.ReactNode, text: string): boolean => {
    if (typeof node === 'string') return node.includes(text)
    if (!React.isValidElement(node)) return false

    const children = isObjectRecord(node.props) ? node.props.children : undefined
    return React.Children.toArray(children as React.ReactNode).some((child) => containsText(child, text))
  }

  const containsMessage = (node: React.ReactNode, message: string): boolean => {
    if (!React.isValidElement(node)) return false
    if (isObjectRecord(node.props) && node.props.message === message) return true

    const children = isObjectRecord(node.props) ? node.props.children : undefined
    return React.Children.toArray(children as React.ReactNode).some((child) => containsMessage(child, message))
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

  it('uses guard-active fallback and messaging independently of the deployment environment', async () => {
    process.env.VERCEL_ENV = 'production'
    headersMock.mockResolvedValue(
      new Headers({
        [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1',
      }),
    )
    const LoginPage = await getLoginPage()

    const result = await LoginPage({
      searchParams: Promise.resolve({
        next: '//evil.example.com',
      }),
    })
    const loginRoot = findLoginRootElement(result)

    expect(loginRoot?.props.redirectPath).toBe('/patient/favorites')
    expect(containsHref(result, '/register/patient')).toBe(false)
    expect(
      containsMessage(result, 'While Preview Guard is active, patient accounts are created by findmydoc staff.'),
    ).toBe(true)
    expect(containsText(result, 'While Preview Guard is active')).toBe(false)
  })

  it('keeps public registration visible when Preview Guard is inactive in Preview', async () => {
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
