import React from 'react'
import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import { ClinicComparison } from '@/components/templates/ClinicComparison/Component'
import { ClinicComparisonFilters } from './ClinicComparisonFilters.client'

export default function ClinicFiltersPage() {
  return (
    <ClinicComparison
      hero={{
        title: 'Compare clinic prices',
        subtitle: 'Transparent pricing for medical treatments near you',
        features: ['500+ verified clinics', 'Reviewed prices', 'Free comparison'],
        bulletStyle: 'circle',
      }}
      filters={<ClinicComparisonFilters cityOptions={[]} waitTimeOptions={[]} treatmentOptions={[]} />}
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
          { value: '500+', label: 'Verified clinics', Icon: Users },
          { value: '1,200+', label: 'Treatment types', Icon: BadgeCheck },
          { value: '98%', label: 'Satisfaction rate', Icon: Award },
          { value: 'TÜV', label: 'Verified platform', Icon: Shield },
        ],
        badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
      }}
    />
  )
}
