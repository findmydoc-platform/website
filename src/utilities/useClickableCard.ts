'use client'
import type { RefObject } from 'react'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

/**
 * Return type for useClickableCard hook containing card and link refs.
 */
type UseClickableCardType<T extends HTMLElement> = {
  card: {
    ref: RefObject<T | null>
  }
  link: {
    ref: RefObject<HTMLAnchorElement | null>
  }
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
 *     <div ref={card.ref} className="cursor-pointer">
 *       <h3>
 *         <a ref={link.ref} href={`/posts/${post.slug}`}>
 *           {post.title}
 *         </a>
 *       </h3>
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
  const card = useRef<T>(null)
  const link = useRef<HTMLAnchorElement>(null)
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
    [router, card, link, timeDown],
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (link.current?.href) {
        const timeNow = +new Date()
        const difference = timeNow - timeDown.current

        if (link.current?.href && difference <= 250) {
          if (!hasActiveParent.current && pressedButton.current === 0 && !e.ctrlKey) {
            if (external) {
              const target = newTab ? '_blank' : '_self'
              window.open(link.current.href, target)
            } else {
              router.push(link.current.href, { scroll })
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, card, link, timeDown],
  )

  useEffect(() => {
    const cardNode = card.current

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
  }, [card, link, router])

  return {
    card: {
      ref: card,
    },
    link: {
      ref: link,
    },
  }
}

export default useClickableCard
