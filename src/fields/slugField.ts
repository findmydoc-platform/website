import { slugField as payloadSlugField } from 'payload'

/** Keep native slug rules, but finish generation before the slug field validates. */
export const slugField: typeof payloadSlugField = (options = {}) =>
  payloadSlugField({
    ...options,
    overrides: (row) => {
      const checkboxName = options.checkboxName ?? 'generateSlug'
      const slugName = options.name ?? 'slug'
      const checkbox = row.fields.find((field) => field.type === 'checkbox' && field.name === checkboxName)
      const slug = row.fields.find((field) => field.type === 'text' && field.name === slugName)

      if (checkbox?.type !== 'checkbox' || slug?.type !== 'text') {
        throw new Error('Payload slug fields must include their native checkbox and text field.')
      }

      const [generateSlug, ...checkboxHooks] = checkbox.hooks?.beforeChange ?? []
      if (!generateSlug) {
        throw new Error('Payload slug fields must include their native generation hook.')
      }

      checkbox.hooks = { ...checkbox.hooks, beforeChange: checkboxHooks }
      slug.hooks = {
        ...slug.hooks,
        beforeChange: [
          async (args) => {
            const checked = await generateSlug({
              ...args,
              field: checkbox,
              value: args.siblingData[checkboxName],
            })
            if (checked !== undefined) args.siblingData[checkboxName] = checked
            return args.siblingData[slugName]
          },
          ...(slug.hooks?.beforeChange ?? []),
        ],
      }

      return options.overrides?.(row) ?? row
    },
  })
