'use client'
import type { RefObject } from 'react'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Return type for useClickableCard hook containing card and link refs.
 */
type UseClickableCardType<T extends HTMLElement> = {
  cardRef: RefObject<T | null>
  linkRef: RefObject<HTMLAnchorElement | null>
}

/**
 * Configuration options for clickable card behavior.
 */
interface Props {
  external?: boolean
  newTab?: boolean
  scroll?: boolean
}

/**
 * React hook that makes an entire card clickable based on a link within it.
 * Handles click events, navigation, and prevents conflicts with other interactive elements.
 *
 * @param options - Configuration options for the clickable behavior
 * @param options.external - Whether the link is external (default: false)
 * @param options.newTab - Whether to open links in a new tab (default: false)
 * @param options.scroll - Whether to scroll to top on navigation (default: true)
 * @returns Object containing refs for the card container and target link
 *
 * @example
 * function PostCard({ post }) {
 *   const { card, link } = useClickableCard({ external: false })
 *
 *   return (
 *     <div ref={card.ref} className="clickable">
 *       <Heading as="h3" align="left">
 *         <a ref={link.ref} href={`/posts/${post.slug}`}>
 *           {post.title}
 *         </a>
 *       </Heading>
 *       <p>{post.excerpt}</p>
 *     </div>
 *   )
 * }
 */
function useClickableCard<T extends HTMLElement>({
  external = false,
  newTab = false,
  scroll = true,
}: Props): UseClickableCardType<T> {
  const router = useRouter()
  const cardRef = useRef<T>(null)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const timeDown = useRef<number>(0)
  const hasActiveParent = useRef<boolean>(false)
  const pressedButton = useRef<number>(0)

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.target) {
        const target = e.target as Element

        const timeNow = +new Date()
        const parent = target?.closest('a')

        pressedButton.current = e.button

        if (!parent) {
          hasActiveParent.current = false
          timeDown.current = timeNow
        } else {
          hasActiveParent.current = true
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, cardRef, linkRef, timeDown],
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (linkRef.current?.href) {
        const timeNow = +new Date()
        const difference = timeNow - timeDown.current

        if (linkRef.current?.href && difference <= 250) {
          if (!hasActiveParent.current && pressedButton.current === 0 && !e.ctrlKey) {
            if (external) {
              const target = newTab ? '_blank' : '_self'
              window.open(linkRef.current.href, target)
            } else {
              router.push(linkRef.current.href, { scroll })
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, cardRef, linkRef, timeDown],
  )

  useEffect(() => {
    const cardNode = cardRef.current

    const abortController = new AbortController()

    if (cardNode) {
      cardNode.addEventListener('mousedown', handleMouseDown, {
        signal: abortController.signal,
      })
      cardNode.addEventListener('mouseup', handleMouseUp, {
        signal: abortController.signal,
      })
    }

    return () => {
      abortController.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRef, linkRef, router])

  return {
    cardRef,
    linkRef,
  }
}

export default useClickableCard
