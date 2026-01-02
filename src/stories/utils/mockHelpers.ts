export const createDelayedJsonResponse = (
  body: Record<string, unknown>,
  status = 200,
  delayMs = 120,
): Promise<Response> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }, delayMs)
  })
