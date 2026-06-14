import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card'
import { Container } from '@/components/molecules/Container'
import { DisclaimerNotice } from '@/components/molecules/DisclaimerNotice'
import { DISCLAIMER_COPY } from '@/utilities/legal/disclaimers'
import { withViewportStory } from '../utils/viewportMatrix'

const routeDisclaimerExamples = [
  {
    routeLabel: 'Platform',
    copy: DISCLAIMER_COPY.platform,
  },
  {
    routeLabel: 'Blog',
    copy: DISCLAIMER_COPY.blog,
  },
  {
    routeLabel: 'Clinic profiles',
    copy: DISCLAIMER_COPY.clinicProfiles,
  },
  {
    routeLabel: 'Comparison pages',
    copy: DISCLAIMER_COPY.comparisonPages,
  },
] as const

const legalPreviewCopy = DISCLAIMER_COPY.comparisonPages

function DisclaimerComparisonBoard() {
  return (
    <article className="bg-gradient-to-b from-background via-background to-muted/25 py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-6xl space-y-10">
          <header className="space-y-3">
            <Heading as="h1" size="h1" align="left" className="text-3xl sm:text-4xl">
              Disclaimer options for medical content
            </Heading>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Three alternatives for legal safety without making the page feel blocked, loud, or visually fragile.
            </p>
          </header>

          <section aria-label="Variant comparison" className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-background p-5 shadow-xs">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Light surface
                  </p>
                  <Heading as="h2" size="h3" align="left" className="mt-1 text-2xl">
                    Calm, neutral base
                  </Heading>
                </div>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                  The note reads like part of the layout, not like an interruption.
                </p>
              </div>

              <div className="grid gap-4">
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="inline-note"
                  surface="light"
                />
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="slim-notice-bar"
                  surface="light"
                />
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="collapsible-disclosure"
                  surface="light"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-muted/50 p-5 shadow-xs">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                    Muted surface
                  </p>
                  <Heading as="h2" size="h3" align="left" className="mt-1 text-2xl">
                    Slightly darker support
                  </Heading>
                </div>
                <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                  Useful for pages that already carry cards, results, or dense content around the disclaimer.
                </p>
              </div>

              <div className="grid gap-4">
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="inline-note"
                  surface="muted"
                />
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="slim-notice-bar"
                  surface="muted"
                />
                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="collapsible-disclosure"
                  surface="muted"
                />
              </div>
            </div>
          </section>

          <section aria-label="Route examples" className="space-y-4">
            <div className="space-y-2">
              <Heading as="h2" size="h2" align="left" className="text-2xl sm:text-3xl">
                Route-specific copy examples
              </Heading>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                The same visual treatment can stay in place while the exact disclaimer text changes per surface.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {routeDisclaimerExamples.map((example) => (
                <DisclaimerNotice
                  key={example.routeLabel}
                  routeLabel={example.routeLabel}
                  copy={example.copy}
                  variant="inline-note"
                  size="compact"
                  surface="light"
                  showVariantLabel={false}
                />
              ))}
            </div>
          </section>

          <section aria-label="Context preview" className="space-y-4">
            <div className="space-y-2">
              <Heading as="h2" size="h2" align="left" className="text-2xl sm:text-3xl">
                In-context placement
              </Heading>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                This shows the note sitting under real page copy so it stays visible without becoming the dominant
                message.
              </p>
            </div>

            <Card className="border-border/70 bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="text-xl">A clearer way to compare clinics</CardTitle>
                <CardDescription>
                  A small legal note sits below the content stream, not above it, so the page keeps a content-first
                  feel.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Treatment
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">Treatment types remain the primary filter.</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                      Location
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      Cities and regions stay visible in the flow.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Price</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">Price fields are shown where available.</p>
                  </div>
                </div>

                <DisclaimerNotice
                  routeLabel="Comparison pages"
                  copy={legalPreviewCopy}
                  variant="inline-note"
                  surface="light"
                  showVariantLabel={false}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </Container>
    </article>
  )
}

const meta = {
  title: 'Internal/Compliance/Templates/DisclaimerOptions',
  component: DisclaimerNotice,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:compliance', 'layer:template', 'status:experimental', 'used-in:shared'],
} satisfies Meta<typeof DisclaimerNotice>

export default meta

type Story = StoryObj<typeof meta>

export const InlineNote: Story = {
  args: {
    routeLabel: 'Platform',
    copy: routeDisclaimerExamples[0].copy,
    variant: 'inline-note',
    surface: 'light',
  },
}

export const InlineNote320: Story = withViewportStory(InlineNote, 'public320', 'Inline Note / 320')
export const InlineNote375: Story = withViewportStory(InlineNote, 'public375', 'Inline Note / 375')
export const InlineNote640: Story = withViewportStory(InlineNote, 'public640', 'Inline Note / 640')
export const InlineNote768: Story = withViewportStory(InlineNote, 'public768', 'Inline Note / 768')
export const InlineNote1024: Story = withViewportStory(InlineNote, 'public1024', 'Inline Note / 1024')
export const InlineNote1280: Story = withViewportStory(InlineNote, 'public1280', 'Inline Note / 1280')

export const SlimNoticeBar: Story = {
  args: {
    routeLabel: 'Blog',
    copy: routeDisclaimerExamples[1].copy,
    variant: 'slim-notice-bar',
    surface: 'light',
  },
}

export const SlimNoticeBar320: Story = withViewportStory(SlimNoticeBar, 'public320', 'Slim Notice Bar / 320')
export const SlimNoticeBar375: Story = withViewportStory(SlimNoticeBar, 'public375', 'Slim Notice Bar / 375')
export const SlimNoticeBar640: Story = withViewportStory(SlimNoticeBar, 'public640', 'Slim Notice Bar / 640')
export const SlimNoticeBar768: Story = withViewportStory(SlimNoticeBar, 'public768', 'Slim Notice Bar / 768')
export const SlimNoticeBar1024: Story = withViewportStory(SlimNoticeBar, 'public1024', 'Slim Notice Bar / 1024')
export const SlimNoticeBar1280: Story = withViewportStory(SlimNoticeBar, 'public1280', 'Slim Notice Bar / 1280')

export const CollapsibleDisclosure: Story = {
  args: {
    routeLabel: 'Clinic profiles',
    copy: routeDisclaimerExamples[2].copy,
    variant: 'collapsible-disclosure',
    surface: 'light',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const toggle = canvas.getByRole('button', { name: 'Why this note appears' })

    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle)

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })

    expect(canvas.getByText(routeDisclaimerExamples[2].copy)).toBeInTheDocument()
  },
}

export const CollapsibleDisclosure320: Story = withViewportStory(
  CollapsibleDisclosure,
  'public320',
  'Collapsible Disclosure / 320',
)
export const CollapsibleDisclosure375: Story = withViewportStory(
  CollapsibleDisclosure,
  'public375',
  'Collapsible Disclosure / 375',
)
export const CollapsibleDisclosure640: Story = withViewportStory(
  CollapsibleDisclosure,
  'public640',
  'Collapsible Disclosure / 640',
)
export const CollapsibleDisclosure768: Story = withViewportStory(
  CollapsibleDisclosure,
  'public768',
  'Collapsible Disclosure / 768',
)
export const CollapsibleDisclosure1024: Story = withViewportStory(
  CollapsibleDisclosure,
  'public1024',
  'Collapsible Disclosure / 1024',
)
export const CollapsibleDisclosure1280: Story = withViewportStory(
  CollapsibleDisclosure,
  'public1280',
  'Collapsible Disclosure / 1280',
)

export const ComparisonBoard: Story = {
  args: {
    routeLabel: 'Comparison pages',
    copy: legalPreviewCopy,
    variant: 'inline-note',
    surface: 'light',
    size: 'default',
    showVariantLabel: true,
  },
  render: () => <DisclaimerComparisonBoard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole('heading', { name: 'Disclaimer options for medical content' })).toBeInTheDocument()
    expect(canvas.getAllByText('Inline note').length).toBeGreaterThan(0)
    expect(canvas.getAllByText('Slim notice bar').length).toBeGreaterThan(0)
    expect(canvas.getAllByText('Collapsible disclosure').length).toBeGreaterThan(0)

    for (const example of routeDisclaimerExamples) {
      expect(canvas.getAllByText(example.routeLabel).length).toBeGreaterThan(0)
      expect(canvas.getAllByText(example.copy).length).toBeGreaterThan(0)
    }

    const disclosureScope = canvas.getByRole('region', { name: 'Variant comparison' })
    const lightSurfaceScope = within(disclosureScope).getByRole('region', { name: 'Light surface' })
    const disclosureButton = within(lightSurfaceScope).getByRole('button', { name: 'Why this note appears' })
    await userEvent.click(disclosureButton)

    await waitFor(() => {
      expect(disclosureButton).toHaveAttribute('aria-expanded', 'true')
    })
  },
}
