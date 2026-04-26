const VIEWPORT_HEIGHT = '900px'
const SHORT_VIEWPORT_HEIGHT = '700px'

export const PUBLIC_STORYBOOK_VIEWPORTS = {
  public320: {
    name: 'Public 320',
    styles: { width: '320px', height: VIEWPORT_HEIGHT },
    type: 'mobile',
  },
  public375: {
    name: 'Public 375',
    styles: { width: '375px', height: VIEWPORT_HEIGHT },
    type: 'mobile',
  },
  public640: {
    name: 'Public 640',
    styles: { width: '640px', height: VIEWPORT_HEIGHT },
    type: 'mobile',
  },
  public768: {
    name: 'Public 768',
    styles: { width: '768px', height: VIEWPORT_HEIGHT },
    type: 'tablet',
  },
  public1024: {
    name: 'Public 1024',
    styles: { width: '1024px', height: VIEWPORT_HEIGHT },
    type: 'desktop',
  },
  public1280: {
    name: 'Public 1280',
    styles: { width: '1280px', height: VIEWPORT_HEIGHT },
    type: 'desktop',
  },
  public320Short: {
    name: 'Public 320 short',
    styles: { width: '320px', height: SHORT_VIEWPORT_HEIGHT },
    type: 'mobile',
  },
  public375Short: {
    name: 'Public 375 short',
    styles: { width: '375px', height: SHORT_VIEWPORT_HEIGHT },
    type: 'mobile',
  },
} as const

export type PublicViewportKey = keyof typeof PUBLIC_STORYBOOK_VIEWPORTS

const PUBLIC_STORYBOOK_VIEWPORT_WIDTHS: Record<PublicViewportKey, number> = {
  public320: 320,
  public375: 375,
  public640: 640,
  public768: 768,
  public1024: 1024,
  public1280: 1280,
  public320Short: 320,
  public375Short: 375,
}

export const FULL_VIEWPORT_MATRIX_PARAMETERS = {
  chromatic: {
    viewports: Object.values(PUBLIC_STORYBOOK_VIEWPORT_WIDTHS),
  },
}

export const VIEWPORT_STORY_PARAMETERS: Record<
  PublicViewportKey,
  {
    chromatic: { viewports: [number] }
    viewport: { options: typeof PUBLIC_STORYBOOK_VIEWPORTS }
  }
> = Object.fromEntries(
  Object.entries(PUBLIC_STORYBOOK_VIEWPORT_WIDTHS).map(([key, width]) => [
    key,
    {
      chromatic: { viewports: [width] },
      viewport: { options: PUBLIC_STORYBOOK_VIEWPORTS },
    },
  ]),
) as Record<
  PublicViewportKey,
  {
    chromatic: { viewports: [number] }
    viewport: { options: typeof PUBLIC_STORYBOOK_VIEWPORTS }
  }
>

type StoryLike = {
  globals?: Record<string, unknown>
  name?: string
  parameters?: Record<string, unknown>
}

export function withViewportStory<T extends StoryLike>(story: T, viewport: PublicViewportKey, name: string): T {
  const viewportParameters = VIEWPORT_STORY_PARAMETERS[viewport]
  const currentParameters = story.parameters ?? {}
  const currentChromatic = (currentParameters.chromatic as Record<string, unknown> | undefined) ?? {}
  const currentViewport = (currentParameters.viewport as Record<string, unknown> | undefined) ?? {}
  const currentGlobals = story.globals ?? {}
  const currentViewportGlobals = (currentGlobals.viewport as Record<string, unknown> | undefined) ?? {}

  return {
    ...story,
    globals: {
      ...currentGlobals,
      viewport: {
        ...currentViewportGlobals,
        value: viewport,
        isRotated: false,
      },
    },
    name,
    parameters: {
      ...currentParameters,
      chromatic: {
        ...currentChromatic,
        ...viewportParameters.chromatic,
      },
      viewport: {
        ...currentViewport,
        ...viewportParameters.viewport,
      },
    },
  }
}
