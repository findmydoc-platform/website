import { generateBlogArchiveMetadata, renderBlogArchive, type BlogArchiveArgs } from './_components/BlogArchive'

export default function PostsPage() {
  return renderBlogArchive('de')
}

export function generateMetadata(args: BlogArchiveArgs = {}) {
  return generateBlogArchiveMetadata('de', args)
}
