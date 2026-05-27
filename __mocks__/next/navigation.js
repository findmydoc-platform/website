import { fn } from 'storybook/test'

const router = {
  back: fn().mockName('nextNavigationBack'),
  forward: fn().mockName('nextNavigationForward'),
  refresh: fn().mockName('nextNavigationRefresh'),
  push: fn().mockName('nextNavigationPush'),
  replace: fn().mockName('nextNavigationReplace'),
  prefetch: fn().mockName('nextNavigationPrefetch'),
}

export function useRouter() {
  return router
}

export function useSelectedLayoutSegments() {
  return ['admin', 'pages']
}

export function usePathname() {
  return '/'
}

export function useSearchParams() {
  return new URLSearchParams()
}

export function useParams() {
  return {}
}

export function useSelectedLayoutSegment() {
  return null
}

export function redirect(path) {
  throw new Error(`Storybook next/navigation redirect: ${path}`)
}

export function notFound() {
  throw new Error('Storybook next/navigation notFound')
}
