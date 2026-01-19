import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { Container } from '@/components/molecules/Container'
import { SectionBackground } from '@/components/molecules/SectionBackground'

import clinicHospitalExterior from '@/stories/assets/clinic-hospital-exterior.jpg'

const meta = {
  title: 'Molecules/SectionBackground',
  component: SectionBackground,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SectionBackground>

export default meta

type Story = StoryObj<typeof meta>

const PlaceholderParagraphs = () => {
  return (
    <div className="mt-6 max-w-3xl space-y-4 text-lg text-slate-200">
      <p>
        This is intentionally long placeholder content so you can observe how the background layer moves while you
        scroll through the section.
      </p>
      <p>
        The parallax effect is section-scoped: as this section enters and exits the viewport, the background layer
        translates subtly.
      </p>
      <p>
        Keep motion subtle. Only transforms are animated (no layout thrash), and the effect is automatically disabled
        when the user prefers reduced motion.
      </p>
      <p>
        Tip: scroll slowly and watch the image edges. We apply a slight scale to avoid seeing gaps when translating.
      </p>
    </div>
  )
}

export const StaticOverlay: Story = {
  parameters: {
    demoFrame: { maxWidth: 'full', padded: false },
  },
  args: {
    as: 'section',
    className: 'min-h-(--min-height-hero) flex items-center bg-slate-900 text-white',
    media: {
      src: clinicHospitalExterior,
      alt: 'Background media',
      imgClassName: 'opacity-40',
      priority: true,
    },
    overlay: {
      kind: 'custom',
      className: 'bg-linear-to-t from-slate-900 via-(--color-slate-900-40) to-transparent',
    },
    children: (
      <Container className="py-28">
        <h2 className="text-4xl font-bold">Section background</h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-200">
          Shared wrapper for background media + overlay + content layering.
        </p>
        <PlaceholderParagraphs />
      </Container>
    ),
  },
}

export const ScrollParallax: Story = {
  parameters: {
    layout: 'fullscreen',
    demoFrame: { maxWidth: 'full', padded: false },
  },
  args: {
    children: null,
  },
  render: () => {
    return (
      <div className="bg-white">
        <Container className="py-24">
          <h2 className="text-foreground text-4xl font-bold">Scroll area</h2>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg">
            Scroll down into the parallax section. This spacer exists so you can see the background start moving as the
            section enters the viewport.
          </p>
          <div className="text-foreground mt-10 space-y-4 text-lg">
            <p>
              Placeholder content block one. Use this story to validate the parallax tuning (range and scale) under real
              scroll conditions.
            </p>
            <p>
              Placeholder content block two. The parallax is driven by section-relative progress, not full page scroll.
            </p>
          </div>
        </Container>

        <Container className="py-24">
          <h2 className="text-foreground text-3xl font-semibold">More scroll before</h2>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg">
            Extra placeholder content so the parallax section begins off-screen. Scroll through this area to let the
            background start moving before you see it.
          </p>
          <div className="text-foreground mt-10 space-y-4 text-lg">
            <p>
              Additional block A. The goal is to have enough vertical space so the section&apos;s center crosses the
              viewport while you are already scrolling.
            </p>
            <p>
              Additional block B. In a real page this would be other sections, copy, or UI, but for the demo we just
              need reliable scroll distance.
            </p>
            <p>
              Additional block C. Keep an eye on the hero image as it approaches the viewport to see the parallax kick
              in.
            </p>
          </div>
        </Container>

        <SectionBackground
          as="section"
          className="flex min-h-(--min-height-hero) items-center bg-slate-900 text-white"
          media={{
            src: clinicHospitalExterior,
            alt: 'Background media',
            imgClassName: 'opacity-40',
            priority: true,
          }}
          overlay={{
            kind: 'solid',
            tone: 'backdrop',
            opacity: 50,
          }}
          parallax={{
            mode: 'scroll',
            rangePx: 128,
            scale: 1.06,
          }}
        >
          <Container className="py-28">
            <h2 className="text-4xl font-bold">Scroll parallax</h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-200">
              Background layer moves subtly as you scroll through this section.
            </p>
            <PlaceholderParagraphs />
          </Container>
        </SectionBackground>

        <Container className="py-24">
          <h2 className="text-foreground text-4xl font-bold">More scroll</h2>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg">
            More filler content after the parallax section so you can watch the background settle as the section exits.
          </p>
          <div className="text-foreground mt-10 space-y-4 text-lg">
            <p>
              Placeholder content block three. This should be enough space to see the full progression through the
              section.
            </p>
            <p>
              Placeholder content block four. If you want a stronger effect, increase rangePx slightly (keep it subtle).
            </p>
          </div>
        </Container>

        <Container className="py-24">
          <h2 className="text-foreground text-3xl font-semibold">More scroll after</h2>
          <p className="text-muted-foreground mt-4 max-w-3xl text-lg">
            This extra section makes sure the parallax motion continues as the hero leaves the viewport and settles back
            to rest.
          </p>
          <div className="text-foreground mt-10 space-y-4 text-lg">
            <p>
              Additional block D. As you scroll past the parallax section, the background should smoothly drift back
              toward its neutral position.
            </p>
            <p>
              Additional block E. Use this area to confirm there are no sudden jumps or stutters at the end of the
              motion.
            </p>
            <p>
              Additional block F. If you still want more emphasis, we can further adjust the range or easing just for
              this Storybook demo.
            </p>
          </div>
        </Container>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = await canvas.findByRole('heading', { name: /scroll parallax/i })

    const root = heading.closest<HTMLElement>('[data-section-background-root]')
    expect(root).not.toBeNull()

    const media = root?.querySelector<HTMLElement>('[data-section-background-media]')
    expect(media).not.toBeNull()

    const win = canvasElement.ownerDocument.defaultView
    expect(win).not.toBeNull()
    if (!win || !media) return

    // Capture the current value (it may already be non-zero due to initial positioning).
    const before = media.style.getPropertyValue('--fmd-section-bg-y')

    // Scroll enough that the section's center meaningfully changes relative to the viewport.
    win.scrollTo(0, Math.max(0, win.document.documentElement.scrollHeight - win.innerHeight))

    // Wait a couple frames for scroll->rAF->spring updates to flush.
    await new Promise<void>((resolve) => {
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
    })

    const after = media.style.getPropertyValue('--fmd-section-bg-y')

    expect(after).toBeTruthy()
    expect(after).not.toEqual(before)
  },
}

export const PointerParallax: Story = {
  parameters: {
    layout: 'fullscreen',
    demoFrame: { maxWidth: 'full', padded: false },
  },
  args: {
    children: null,
  },
  render: () => {
    return (
      <SectionBackground
        as="section"
        className="flex min-h-(--min-height-hero) items-center bg-slate-900 text-white"
        media={{
          src: clinicHospitalExterior,
          alt: 'Background media',
          imgClassName: 'opacity-40',
          priority: true,
        }}
        overlay={{
          kind: 'custom',
          className: 'bg-linear-to-t from-slate-900 via-(--color-slate-900-40) to-transparent',
        }}
        parallax={{
          mode: 'pointer',
          rangePx: 18,
          scale: 1.06,
        }}
      >
        <Container className="py-28">
          <h2 className="text-4xl font-bold">Pointer parallax</h2>
          <p className="mt-4 max-w-2xl text-lg text-slate-200">
            Move your pointer within the section. This mode is disabled on coarse pointers and when reduced motion is
            enabled.
          </p>
          <PlaceholderParagraphs />
        </Container>
      </SectionBackground>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const heading = await canvas.findByRole('heading', { name: /pointer parallax/i })

    const root = heading.closest<HTMLElement>('[data-section-background-root]')
    expect(root).not.toBeNull()

    const media = root?.querySelector<HTMLElement>('[data-section-background-media]')
    expect(media).not.toBeNull()

    const win = canvasElement.ownerDocument.defaultView
    expect(win).not.toBeNull()
    if (!win || !root || !media) return

    // Pointer parallax intentionally disables itself on coarse pointers.
    const supportsFinePointer = win.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? false
    if (!supportsFinePointer) return

    const before = media.style.getPropertyValue('--fmd-section-bg-x')
    const rect = root.getBoundingClientRect()

    root.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.9,
        clientY: rect.top + rect.height * 0.5,
      }),
    )

    await new Promise<void>((resolve) => {
      win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve()))
    })

    const after = media.style.getPropertyValue('--fmd-section-bg-x')
    expect(after).toBeTruthy()
    expect(after).not.toEqual(before)
  },
}
