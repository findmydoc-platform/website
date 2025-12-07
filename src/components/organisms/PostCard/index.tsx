'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment, createContext, useContext } from 'react'

import type { Post } from '@/payload-types'

import { Media as MediaComponent } from '@/components/molecules/Media'

export type PostCardData = Pick<Post, 'slug' | 'categories' | 'meta' | 'title'>

type PostCardContextType = {
  doc: PostCardData
  relationTo: string
  href: string
  linkRef: React.RefObject<HTMLAnchorElement | null>
}

const PostCardContext = createContext<PostCardContextType | null>(null)

const usePostCardContext = () => {
  const context = useContext(PostCardContext)
  if (!context) {
    throw new Error('usePostCardContext must be used within PostCard.Root')
  }
  return context
}

const Root = ({
  children,
  className,
  doc,
  relationTo,
}: {
  children: React.ReactNode
  className?: string
  doc: PostCardData
  relationTo: string
}) => {
  const { cardRef, linkRef } = useClickableCard<HTMLElement>({})
  const { slug } = doc
  const href = `/${relationTo}/${slug}`

  return (
    <PostCardContext.Provider value={{ doc, relationTo, href, linkRef }}>
      <article
        className={cn('overflow-hidden rounded-lg border border-border bg-card hover:cursor-pointer', className)}
        ref={cardRef}
      >
        {children}
      </article>
    </PostCardContext.Provider>
  )
}

const Media = ({ className }: { className?: string }) => {
  const { doc } = usePostCardContext()
  const { meta } = doc
  const { image: metaImage } = meta || {}

  return (
    <div className={cn('relative w-full', className)}>
      {!metaImage && <div className="">No image</div>}
      {metaImage && typeof metaImage !== 'string' && <MediaComponent resource={metaImage} size="33vw" />}
    </div>
  )
}

const Content = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return <div className={cn('p-4', className)}>{children}</div>
}

const Categories = ({ className }: { className?: string }) => {
  const { doc } = usePostCardContext()
  const { categories } = doc
  const hasCategories = categories && Array.isArray(categories) && categories.length > 0

  if (!hasCategories) return null

  return (
    <div className={cn('mb-4 text-sm uppercase', className)}>
      {categories?.map((category, index) => {
        if (typeof category === 'object') {
          const { title: titleFromCategory } = category
          const categoryTitle = titleFromCategory || 'Untitled category'
          const isLast = index === categories.length - 1

          return (
            <Fragment key={index}>
              {categoryTitle}
              {!isLast && <Fragment>, &nbsp;</Fragment>}
            </Fragment>
          )
        }
        return null
      })}
    </div>
  )
}

const Title = ({ className, title: titleOverride }: { className?: string; title?: string }) => {
  const { doc, href, linkRef } = usePostCardContext()
  const { title } = doc
  const titleToUse = titleOverride || title

  if (!titleToUse) return null

  return (
    <div className={cn('prose', className)}>
      <h3>
        <Link className="not-prose" href={href} ref={linkRef}>
          {titleToUse}
        </Link>
      </h3>
    </div>
  )
}

const Description = ({ className }: { className?: string }) => {
  const { doc } = usePostCardContext()
  const { meta } = doc
  const { description } = meta || {}
  const sanitizedDescription = description?.replace(/\s/g, ' ')

  if (!description) return null

  return (
    <div className={cn('mt-2', className)}>
      <p>{sanitizedDescription}</p>
    </div>
  )
}

export const PostCard = {
  Root,
  Media,
  Content,
  Categories,
  Title,
  Description,
}
