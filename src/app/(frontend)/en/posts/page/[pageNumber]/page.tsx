import {
  generatePaginatedArchiveMetadata,
  renderPaginatedArchive,
  type BlogPaginationArgs,
} from '@/app/(frontend)/posts/_components/BlogArchive'

export default function EnglishPostsPage(args: BlogPaginationArgs) {
  return renderPaginatedArchive(args, 'en')
}

export function generateMetadata(args: BlogPaginationArgs) {
  return generatePaginatedArchiveMetadata(args, 'en')
}
