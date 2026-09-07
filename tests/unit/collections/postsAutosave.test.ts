import { describe, expect, it } from 'vitest'
import { getAutosaveInterval } from 'payload/shared'

import { Posts } from '@/collections/Posts'

describe('Posts autosave', () => {
  it('uses Payloads standard debounce without disabling scheduled publishing', () => {
    expect(getAutosaveInterval(Posts)).toBe(2000)
    expect(Posts.versions).toMatchObject({
      drafts: {
        schedulePublish: true,
      },
    })
  })
})
