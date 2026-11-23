import {
  listingComparisonMetadata,
  renderListingComparisonPage,
  type ListingComparisonPageArgs,
} from './ListingComparisonPage'

export const dynamic = 'force-dynamic'

export function generateMetadata(args: ListingComparisonPageArgs) {
  return listingComparisonMetadata(args, 'de')
}

export default function ListingComparisonPage(args: ListingComparisonPageArgs) {
  return renderListingComparisonPage(args, 'de')
}
