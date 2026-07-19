import { Heading } from '@/components/atoms/Heading'
import { UiLink } from '@/components/molecules/Link'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import type { BlogCardBaseProps } from '@/utilities/blog/normalizePost'

type TemporaryLandingBlogSectionProps = {
  ctaHref: string
  ctaLabel: string
  description: string
  posts: BlogCardBaseProps[]
  title: string
}

export function TemporaryLandingBlogSection({
  ctaHref,
  ctaLabel,
  description,
  posts,
  title,
}: TemporaryLandingBlogSectionProps) {
  if (posts.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="temporary-landing-blog-heading"
      className="mt-6 rounded-[24px] border border-white/74 bg-white/84 p-4 shadow-[0_28px_90px_-48px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:p-5 lg:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="max-w-2xl">
          <Heading
            id="temporary-landing-blog-heading"
            as="h2"
            align="left"
            size="h4"
            className="text-2xl text-slate-950 sm:text-3xl"
          >
            {title}
          </Heading>
          <p className="mt-2 text-sm leading-6 text-slate-700 sm:text-base">{description}</p>
        </div>
        <UiLink
          appearance="outline"
          className="w-full shrink-0 border-slate-300 bg-white/80 sm:w-auto"
          href={ctaHref}
          label={ctaLabel}
        />
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-8 xl:grid-cols-3">
        {posts.map((post) => (
          <BlogCard.Simple key={post.href} {...post} />
        ))}
      </div>
    </section>
  )
}
