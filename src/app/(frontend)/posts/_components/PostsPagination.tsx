import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, buttonVariants } from '@/components/atoms/button'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/atoms/pagination'
import { UiLink } from '@/components/molecules/Link'
import { buildPostsPagePath } from '@/utilities/content/postPaths'
import type { ContentLocale } from '@/utilities/contentLocalization'

type Props = {
  locale: ContentLocale
  copy: {
    label: string
    previous: PageStepCopy
    next: PageStepCopy
  }
  page: number
  totalPages: number
}

type PageStepCopy = { label: string; text: string }

function PageStep({ href, direction, copy }: { href?: string; direction: 'previous' | 'next'; copy: PageStepCopy }) {
  const previous = direction === 'previous'
  const { label, text } = copy
  const Icon = previous ? ChevronLeft : ChevronRight
  const className = previous ? 'gap-2 pl-2' : 'flex-row-reverse gap-2 pr-2'

  if (!href) {
    return (
      <Button aria-label={label} className={className} disabled type="button" variant="ghost">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">{text}</span>
      </Button>
    )
  }

  return (
    <UiLink href={href} appearance="ghost" className={className}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="hidden sm:inline">
          {text}
        </span>
      </span>
    </UiLink>
  )
}

export function PostsPagination({ locale, page, totalPages, copy }: Props) {
  const previous = page > 1 ? buildPostsPagePath(page - 1, { locale }) : undefined
  const next = page < totalPages ? buildPostsPagePath(page + 1, { locale }) : undefined

  return (
    <Pagination aria-label={copy.label} className="my-12">
      <PaginationContent>
        <PaginationItem>
          <PageStep href={previous} direction="previous" copy={copy.previous} />
        </PaginationItem>
        {page > 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {previous && (
          <PaginationItem>
            <UiLink href={previous} appearance="ghost" size="icon">
              {page - 1}
            </UiLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <span
            aria-current="page"
            className={buttonVariants({ variant: 'outline', size: 'icon', className: 'cursor-default' })}
          >
            {page}
          </span>
        </PaginationItem>
        {next && (
          <PaginationItem>
            <UiLink href={next} appearance="ghost" size="icon">
              {page + 1}
            </UiLink>
          </PaginationItem>
        )}
        {page + 1 < totalPages && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        <PaginationItem>
          <PageStep href={next} direction="next" copy={copy.next} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
