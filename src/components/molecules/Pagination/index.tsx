'use client'
import {
  Pagination as PaginationComponent,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/atoms/pagination'
import { cn } from '@/utilities/ui'
import React from 'react'

export type PaginationProps = {
  className?: string
  copy?: { label: string; next: string; previous: string; nextLabel: string; previousLabel: string }
  page: number
  totalPages: number
  onNavigate?: (path: string) => void
  getPathForPage?: (page: number) => string
}

export const Pagination: React.FC<PaginationProps> = (props) => {
  const { className, copy, page, totalPages, onNavigate, getPathForPage } = props
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  const hasExtraPrevPages = page - 1 > 1
  const hasExtraNextPages = page + 1 < totalPages

  const navigate = onNavigate ?? (() => undefined)

  const goToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages) return
    const targetPath = getPathForPage
      ? getPathForPage(targetPage)
      : targetPage === 1
        ? '/posts'
        : `/posts/page/${targetPage}`
    navigate(targetPath)
  }

  return (
    <div className={cn('my-12', className)}>
      <PaginationComponent aria-label={copy?.label ?? 'pagination'}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              label={copy?.previous}
              aria-label={copy?.previousLabel ?? 'Go to previous page'}
              disabled={!hasPrevPage}
              onClick={() => {
                if (hasPrevPage) {
                  goToPage(page - 1)
                }
              }}
            />
          </PaginationItem>

          {hasExtraPrevPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {hasPrevPage && (
            <PaginationItem>
              <PaginationLink
                onClick={() => {
                  goToPage(page - 1)
                }}
              >
                {page - 1}
              </PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationLink
              isActive
              onClick={() => {
                goToPage(page)
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>

          {hasNextPage && (
            <PaginationItem>
              <PaginationLink
                onClick={() => {
                  goToPage(page + 1)
                }}
              >
                {page + 1}
              </PaginationLink>
            </PaginationItem>
          )}

          {hasExtraNextPages && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationNext
              label={copy?.next}
              aria-label={copy?.nextLabel ?? 'Go to next page'}
              disabled={!hasNextPage}
              onClick={() => {
                if (hasNextPage) {
                  goToPage(page + 1)
                }
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </PaginationComponent>
    </div>
  )
}
