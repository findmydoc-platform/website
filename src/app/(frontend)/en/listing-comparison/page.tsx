import {
  listingComparisonMetadata,
  renderListingComparisonPage,
  type ListingComparisonPageArgs,
} from '../../listing-comparison/ListingComparisonPage'

export const dynamic = 'force-dynamic'

export function generateMetadata(args: ListingComparisonPageArgs) {
  return listingComparisonMetadata(args, 'en')
}

export default function ListingComparisonPage(args: ListingComparisonPageArgs) {
  return renderListingComparisonPage(args, 'en')
}
