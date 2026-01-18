import React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import { ListingComparison } from '@/components/templates/ListingComparison/Component'
import { ListingComparisonFilters } from './ListingComparisonFilters.client'

export default function ClinicFiltersPage() {
  return (
    <ListingComparison
      hero={{
        title: 'Compare clinic prices',
        subtitle: 'Transparent pricing for medical treatments near you',
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filters={<ListingComparisonFilters cityOptions={[]} waitTimeOptions={[]} treatmentOptions={[]} />}
      results={[]}
      emptyState={
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Results will appear here once the search API is connected.
        </div>
      }
      trust={{
        title: 'Trust proven quality',
        subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
        stats: [
          { value: 500, suffix: '+', label: 'Verified clinics', Icon: Users },
          { value: 1200, suffix: '+', label: 'Treatment types', Icon: BadgeCheck },
          { value: 98, suffix: '%', label: 'Satisfaction rate', Icon: Award },
          { valueText: 'TÜV', label: 'Verified platform', Icon: Shield },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
