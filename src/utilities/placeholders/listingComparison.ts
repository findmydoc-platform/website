import type { ListingCardData } from '@/components/organisms/Listing'

// TODO: Temporary placeholder data for the listing comparison page.
// This file provides mock filter options and example results for local
// development and Storybook. Once a backend listing-comparison API exists
// and the page fetches real data, this file and its imports should be
// removed/deleted and replaced with backend-driven data fetching.
export const listingComparisonFilterOptions = {
  cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt'],
  waitTimes: [
    { label: 'Up to 1 week', minWeeks: 0, maxWeeks: 1 },
    { label: 'Up to 2 weeks', minWeeks: 0, maxWeeks: 2 },
    { label: 'Up to 4 weeks', minWeeks: 0, maxWeeks: 4 },
    { label: 'Over 4 weeks', minWeeks: 4, maxWeeks: undefined },
  ],
  treatments: ['Hip replacement', 'Knee replacement', 'Cataract surgery', 'Dental implant', 'LASIK eye surgery'],
}

const placeholderMedia = {
  src: '/images/placeholder-576-968.svg',
  alt: 'Clinic placeholder image',
}

export const listingComparisonResultsPlaceholder: ListingCardData[] = [
  {
    name: 'Ring Clinic',
    location: 'Cologne, City Center',
    media: placeholderMedia,
    verification: { variant: 'unverified' },
    rating: { value: 4.4, count: 156 },
    waitTime: { label: '4-5 weeks', minWeeks: 4, maxWeeks: 5 },
    tags: ['Affordable pricing', 'Great facilities', 'Central location'],
    priceFrom: { label: 'From', value: 7200, currency: 'EUR' },
    actions: {
      details: { href: '#', label: 'Details' },
      compare: { href: '#', label: 'Compare' },
    },
  },
  {
    name: 'Munich Medical Center',
    location: 'Munich, Schwabing',
    media: placeholderMedia,
    verification: { variant: 'gold' },
    rating: { value: 4.6, count: 189 },
    waitTime: { label: '3-4 weeks', minWeeks: 3, maxWeeks: 4 },
    tags: ['Specialized orthopedics', 'Short waits', 'On-site physiotherapy'],
    priceFrom: { label: 'From', value: 7800, currency: 'EUR' },
    actions: {
      details: { href: '#', label: 'Details' },
      compare: { href: '#', label: 'Compare' },
    },
  },
  {
    name: 'Berlin University Hospital',
    location: 'Berlin, Mitte',
    media: placeholderMedia,
    verification: { variant: 'silver' },
    rating: { value: 4.8, count: 245 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Modern operating rooms', 'Specialist physicians', 'Aftercare included'],
    priceFrom: { label: 'From', value: 8500, currency: 'EUR' },
    actions: {
      details: { href: '#', label: 'Details' },
      compare: { href: '#', label: 'Compare' },
    },
  },
  {
    name: 'Hamburg Vision Center',
    location: 'Hamburg, HafenCity',
    media: placeholderMedia,
    verification: { variant: 'gold' },
    rating: { value: 4.7, count: 201 },
    waitTime: { label: '1-2 weeks', minWeeks: 1, maxWeeks: 2 },
    tags: ['LASIK eye surgery', 'Cataract surgery', 'Harbor shuttle'],
    priceFrom: { label: 'From', value: 8300, currency: 'EUR' },
    actions: {
      details: { href: '#', label: 'Details' },
      compare: { href: '#', label: 'Compare' },
    },
  },
  {
    name: 'Frankfurt Joint Clinic',
    location: 'Frankfurt, Sachsenhausen',
    media: placeholderMedia,
    verification: { variant: 'bronze' },
    rating: { value: 4.4, count: 154 },
    waitTime: { label: '2-3 weeks', minWeeks: 2, maxWeeks: 3 },
    tags: ['Knee replacement', 'Hip replacement', 'On-site rehab gym'],
    priceFrom: { label: 'From', value: 10200, currency: 'EUR' },
    actions: {
      details: { href: '#', label: 'Details' },
      compare: { href: '#', label: 'Compare' },
    },
  },
]
