import {
  generateBlogArchiveMetadata,
  renderBlogArchive,
  type BlogArchiveArgs,
} from '@/app/(frontend)/posts/_components/BlogArchive'

export default function EnglishPostsPage() {
  return renderBlogArchive('en')
}

export function generateMetadata(args: BlogArchiveArgs = {}) {
  return generateBlogArchiveMetadata('en', args)
}
