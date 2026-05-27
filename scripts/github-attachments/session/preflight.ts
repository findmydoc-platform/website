import { DEFAULT_USER_AGENT } from '../config'

export type GitHubSessionPreflightResult = {
  loggedIn: boolean
  status: number
  url: string
}

export const runGitHubSessionPreflight = async (
  targetUrl: string,
  cookieHeader: string,
): Promise<GitHubSessionPreflightResult> => {
  const response = await fetch(targetUrl, {
    headers: {
      accept: 'text/html',
      cookie: cookieHeader,
      'user-agent': DEFAULT_USER_AGENT,
    },
    redirect: 'follow',
  })

  const html = await response.text()
  const loggedIn =
    response.ok &&
    !response.url.includes('/login') &&
    !html.includes('name="login"') &&
    (html.includes('name="fetch-nonce"') || html.includes('data-target="react-app.reactRoot"'))

  return {
    loggedIn,
    status: response.status,
    url: response.url,
  }
}
