import {
  generatePaginatedArchiveMetadata,
  renderPaginatedArchive,
  type BlogPaginationArgs,
} from '../../_components/BlogArchive'

export default function PostsPage(args: BlogPaginationArgs) {
  return renderPaginatedArchive(args, 'de')
}

export function generateMetadata(args: BlogPaginationArgs) {
  return generatePaginatedArchiveMetadata(args, 'de')
}
