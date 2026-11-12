import { setImmediate } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { withMcpResponseCompletion } from '@/features/mcp/responseCompletion'

describe('MCP response completion', () => {
  it('keeps the route open until the complete tool result is available', async () => {
    let finish!: () => void
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        finish = () => {
          controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n'))
          controller.close()
        }
      },
    })
    const handler = withMcpResponseCompletion(
      async () => new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } }),
    )
    let returned = false
    const pending = handler(new Request('https://findmydoc.eu/api/mcp', { method: 'POST' })).then((response) => {
      returned = true
      return response
    })
    try {
      await setImmediate()
      expect(returned).toBe(false)
    } finally {
      finish()
    }
    const response = await pending
    expect(await response.text()).toBe('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n')
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    expect(response.headers.get('cache-control')).toBe('no-cache')
  })

  it.each([
    ['GET', '/api/mcp'],
    ['POST', '/api/clinics'],
    ['POST', '/api/mcp-other'],
  ])('preserves streaming for %s %s', async (method, path) => {
    const source = new Response('ordinary response')
    const handler = withMcpResponseCompletion(async () => source)
    const response = await handler(new Request(`https://findmydoc.eu${path}`, { method }))
    expect(response).toBe(source)
    expect(source.bodyUsed).toBe(false)
    expect(await response.text()).toBe('ordinary response')
  })

  it('preserves authentication errors and their response metadata', async () => {
    const source = new Response('{"errors":[{"message":"Unauthorized"}]}', {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'content-type': 'application/json',
        'cache-control': 'private, no-store',
        'www-authenticate': 'Bearer',
      },
    })
    const handler = withMcpResponseCompletion(async () => source)
    const response = await handler(new Request('https://findmydoc.eu/api/mcp', { method: 'POST' }))
    expect(response.status).toBe(401)
    expect(response.statusText).toBe('Unauthorized')
    expect(Object.fromEntries(response.headers)).toEqual(Object.fromEntries(source.headers))
    expect(await response.json()).toEqual({ errors: [{ message: 'Unauthorized' }] })
  })

  it('preserves empty notification responses', async () => {
    const source = new Response(null, { status: 202 })
    const handler = withMcpResponseCompletion(() => source)
    const response = await handler(new Request('https://findmydoc.eu/api/mcp', { method: 'POST' }))
    expect(response).toBe(source)
    expect(response.status).toBe(202)
  })

  it('rejects an incomplete tool result when its body fails', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('Synthetic transport interruption'))
      },
    })
    const handler = withMcpResponseCompletion(async () => new Response(body))
    await expect(handler(new Request('https://findmydoc.eu/api/mcp', { method: 'POST' }))).rejects.toThrow(
      'Synthetic transport interruption',
    )
  })
})
