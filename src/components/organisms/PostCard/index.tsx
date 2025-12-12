'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment, createContext, useContext } from 'react'

import { Media as MediaComponent } from '@/components/molecules/Media'

export type PostCardData = {
  title: string
  href: string
  description?: string
  image?: {
    src: string
    alt: string
    width?: number
    height?: number
  }
  categories?: string[]
}

type PostCardContextType = {
  data: PostCardData
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

const Root = ({ children, className, data }: { children: React.ReactNode; className?: string; data: PostCardData }) => {
  const { cardRef, linkRef } = useClickableCard<HTMLElement>({})

  return (
    <PostCardContext.Provider value={{ data, linkRef }}>
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
  const { data } = usePostCardContext()
  const { image } = data

  return (
    <div className={cn('relative w-full', className)}>
      {!image && <div className="">No image</div>}
      {image && (
        <MediaComponent src={image.src} alt={image.alt} width={image.width} height={image.height} size="33vw" />
      )}
    </div>
  )
}

const Content = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return <div className={cn('p-4', className)}>{children}</div>
}

const Categories = ({ className }: { className?: string }) => {
  const { data } = usePostCardContext()
  const { categories } = data
  const hasCategories = categories && Array.isArray(categories) && categories.length > 0

  if (!hasCategories) return null

  return (
    <div className={cn('mb-4 text-sm uppercase', className)}>
      {categories?.map((category, index) => {
        const isLast = index === categories.length - 1
        return (
          <Fragment key={index}>
            {category}
            {!isLast && <Fragment>, &nbsp;</Fragment>}
          </Fragment>
        )
      })}
    </div>
  )
}

const Title = ({ className, title: titleOverride }: { className?: string; title?: string }) => {
  const { data, linkRef } = usePostCardContext()
  const { title, href } = data
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
  const { data } = usePostCardContext()
  const { description } = data
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
