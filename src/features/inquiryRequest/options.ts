export const inquiryTreatmentTimelineOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Within two weeks', value: 'within_two_weeks' },
  { label: 'Within one month', value: 'within_one_month' },
  { label: 'Flexible', value: 'flexible' },
] as const

export const inquiryPreferredContactWindowOptions = [
  { label: 'As soon as possible', value: 'as_soon_as_possible' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
  { label: 'No preference', value: 'no_preference' },
] as const

const requestOptionLabels = new Map<string, string>(
  [...inquiryTreatmentTimelineOptions, ...inquiryPreferredContactWindowOptions].map(({ label, value }) => [
    value,
    label,
  ]),
)

export const formatInquiryRequestOption = (value: string): string => requestOptionLabels.get(value) ?? value
