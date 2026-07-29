import type { GroupField } from 'payload'

export const openingHoursDayNames = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

type OpeningHoursDayName = (typeof openingHoursDayNames)[number]

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeTime = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

const hasConfiguredValue = (value: Record<string, unknown>): boolean =>
  openingHoursDayNames.some((dayName) => {
    const day = value[dayName]
    if (!isRecord(day)) return false

    return day.isClosed === true || normalizeTime(day.opensAt) !== null || normalizeTime(day.closesAt) !== null
  })

export const normalizeOpeningHours = (value: unknown): unknown => {
  if (value === null || value === undefined) return undefined
  if (!isRecord(value)) return value

  const presentDayCount = openingHoursDayNames.filter((dayName) =>
    Object.prototype.hasOwnProperty.call(value, dayName),
  ).length

  if (
    Object.keys(value).length === 0 ||
    (Object.keys(value).length === openingHoursDayNames.length &&
      presentDayCount === openingHoursDayNames.length &&
      !hasConfiguredValue(value))
  ) {
    return undefined
  }

  return {
    ...value,
    ...Object.fromEntries(
      openingHoursDayNames
        .filter((dayName) => Object.prototype.hasOwnProperty.call(value, dayName))
        .map((dayName) => {
          const day = value[dayName]
          if (!day || !isRecord(day)) return [dayName, day]

          const isClosed = day.isClosed

          return [
            dayName,
            {
              isClosed,
              opensAt: isClosed === true ? null : normalizeTime(day.opensAt),
              closesAt: isClosed === true ? null : normalizeTime(day.closesAt),
            },
          ]
        }),
    ),
  }
}

const validateOpeningHours = (value: unknown): true | string => {
  const normalized = normalizeOpeningHours(value)
  if (normalized === undefined) return true
  if (!isRecord(normalized)) return 'Opening hours must be a complete Monday-to-Sunday schedule.'

  const unknownKeys = Object.keys(normalized).filter(
    (key) => !openingHoursDayNames.includes(key as OpeningHoursDayName),
  )
  if (unknownKeys.length > 0) return 'Opening hours contain unsupported day fields.'

  for (const dayName of openingHoursDayNames) {
    const day = normalized[dayName]
    if (!isRecord(day)) return `Opening hours must include ${dayName}.`
    if (typeof day.isClosed !== 'boolean') return `${dayName} must specify whether the clinic is closed.`

    const opensAt = normalizeTime(day.opensAt)
    const closesAt = normalizeTime(day.closesAt)

    if (day.isClosed) {
      if (opensAt !== null || closesAt !== null) return `${dayName} cannot contain times when the clinic is closed.`
      continue
    }

    if (!opensAt || !closesAt) return `${dayName} requires both opening and closing times.`
    if (!timePattern.test(opensAt) || !timePattern.test(closesAt)) {
      return `${dayName} times must use the 24-hour HH:mm format.`
    }
    if (closesAt <= opensAt) return `${dayName} closing time must be later than opening time.`
  }

  return true
}

const buildDayField = (name: OpeningHoursDayName, label: string): GroupField => ({
  name,
  label,
  type: 'group',
  fields: [
    {
      name: 'isClosed',
      label: 'Closed',
      type: 'checkbox',
      admin: {
        description: `Mark ${label} as closed.`,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'opensAt',
          label: 'Opens At',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.isClosed !== true,
            description: 'Local time in 24-hour HH:mm format.',
            placeholder: '09:00',
            width: '50%',
          },
        },
        {
          name: 'closesAt',
          label: 'Closes At',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.isClosed !== true,
            description: 'Local time in 24-hour HH:mm format.',
            placeholder: '17:00',
            width: '50%',
          },
        },
      ],
    },
  ],
})

export const openingHoursField: GroupField = {
  name: 'openingHours',
  label: 'Opening Hours',
  type: 'group',
  admin: {
    description: 'Local opening hours for each day. Leave the whole week empty until it is configured.',
  },
  hooks: {
    afterRead: [({ value }) => normalizeOpeningHours(value)],
    beforeChange: [({ value }) => normalizeOpeningHours(value)],
    beforeValidate: [({ value }) => normalizeOpeningHours(value)],
  },
  validate: validateOpeningHours,
  fields: [
    buildDayField('monday', 'Monday'),
    buildDayField('tuesday', 'Tuesday'),
    buildDayField('wednesday', 'Wednesday'),
    buildDayField('thursday', 'Thursday'),
    buildDayField('friday', 'Friday'),
    buildDayField('saturday', 'Saturday'),
    buildDayField('sunday', 'Sunday'),
  ],
}
