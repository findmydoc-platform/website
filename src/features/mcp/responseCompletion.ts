export function withMcpResponseCompletion<Args extends [Request, ...unknown[]]>(
  handler: (...args: Args) => Promise<Response> | Response,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    const response = await handler(...args)
    const request = args[0]
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/mcp' || !response.body) return response

    // Next.js flushes pending revalidations when the route returns, before an unfinished MCP body completes.
    const body = await response.arrayBuffer()
    return new Response(body, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    })
  }
}
