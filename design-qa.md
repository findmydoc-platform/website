# Clinic Gallery Design QA

## Comparison Target

- Source visual truth: Product Design artifacts `exec-f09b7b0e-08e5-49e6-abdd-f394f880f3f2.png` for the public page and `exec-1243bc07-2f77-49c4-be85-130f4f604c20.png` for the selected charcoal lightbox direction (stored outside the repository)
- Implementation screenshots: `output/playwright/clinic-gallery/desktop-reference-review-fixes.png`, `output/playwright/clinic-gallery/lightbox-mobile-375-charcoal-91-pointer.png`, and `output/playwright/clinic-gallery/lightbox-mobile-375-charcoal-91-keyboard.png`
- Full-view comparisons: `output/playwright/clinic-gallery/reference-comparison-final.png` and `output/playwright/clinic-gallery/lightbox-charcoal-91-comparison.png`
- Focused comparison: `output/playwright/clinic-gallery/focused-comparison-final.png`
- Viewport: `1488 x 1058` CSS pixels, device pixel ratio `1`
- Source pixels: `1487 x 1058`; normalized non-destructively to `1488 x 1058` by adding one white edge pixel
- Implementation pixels: `1488 x 1058`
- State: public clinic overview with twelve gallery images, first image selected as the hero, light public page, gallery closed
- Lightbox viewport: `375 x 812` CSS pixels, device pixel ratio `1`; the generated source was normalized to `375 x 812` and compared with a `375 x 812` browser capture
- Lightbox states: first gallery image opened by pointer without a focus frame, plus the keyboard-opened state with the carousel focus frame visible

## Evidence Reviewed

- The full-view comparison confirms the intended composition: compact title area, description at approximately 55% of the 1080 px content width, one uninterrupted hero image, an external gallery action, and independent 50/50 quality and doctor cards.
- The focused comparison was required because typography, description width, hero crop, gallery action placement, card alignment, icon treatment, and image quality are too small to judge reliably from the full view alone.
- Responsive browser evidence covers `320`, `375`, `640`, `768`, `1024`, and `1280` px widths. In every case the document scroll width equals its client width.
- Mobile lightbox evidence: `output/playwright/clinic-gallery/lightbox-mobile-375-charcoal-91-pointer.png` and `output/playwright/clinic-gallery/lightbox-mobile-375-charcoal-91-keyboard.png`.
- Mobile page evidence: `output/playwright/clinic-gallery/mobile-375-review-fixes.png`.
- Primary interactions tested in Playwright: open gallery, ArrowRight navigation, pointer swipe, Escape close, and focus return to the trigger.
- Browser console: zero errors and zero warnings for the final Storybook gallery states.

## Required Fidelity Surfaces

- Fonts and typography: DM Sans, weights, hierarchy, line height, and wrapping match the existing product system and the source direction. The description is intentionally wider than the source mock according to the approved 50-55% amendment.
- Spacing and layout rhythm: desktop side whitespace is preserved; the gallery does not expand beyond the established content width. Mobile uses the production `Container` gutters, and the hero, action, quality card, and doctor card remain in the approved order.
- Colors and visual tokens: the implementation uses existing findmydoc public-site tokens for canvas, brand blue, navy, cards, verification, borders, and shadows. The lightbox deliberately leaves the opaque brand-blue surface: it uses `rgba(11, 13, 16, 0.91)` with an `8 px` backdrop blur and a quiet neutral overlay. The underlying page remains perceptible without competing with the photo. The public site has no separate dark-theme contract.
- Image quality and asset fidelity: the first image is a dedicated 1600 x 900 photorealistic clinic-reception asset with one continuous scene, a trustworthy healthcare context, and no collage, text, logo, or watermark. Object-cover is used only in the public hero; the lightbox uses object-contain.
- Copy and content: action copy follows the agreed zero, one, and many-image states. Image count, captions, alt text, and doctor/quality content remain realistic and coherent.
- Accessibility and interaction: controls have at least 44 px touch targets, visible focus, semantic dialog/carousel structure, keyboard navigation, Escape close, swipe support, a live image counter, and trigger focus restoration.

## Comparison History

1. Initial comparison found two P2 differences: the title stack was too tall, and the available fixture image looked perceptually split because an exterior strip was embedded beside the reception. The implementation reduced desktop heading scale and section gaps, compacted the production top padding, shortened the doctor preview height, and replaced the fixture with a dedicated continuous reception asset. Post-fix evidence: `reference-comparison-final.png` and `focused-comparison-final.png`.
2. Mobile runtime QA found a P1 lightbox overflow: intrinsic carousel width expanded to approximately 831 px inside a 375 px viewport, clipping the counter, image, and caption. The dialog, inner column, and carousel now explicitly constrain minimum and full widths. Post-fix evidence: `lightbox-mobile-375.png`; the dialog and carousel measure `375 px` and `343 px` respectively.
3. Mobile comparison found a P2 evidence mismatch because the Storybook frame omitted production side gutters. Stories now use the real `Container` component. Post-fix evidence: `mobile-matrix-320.png` and `mobile-matrix-375.png`.
4. Reviewer follow-up found that the doctor list still used a nested scroll region on mobile and that the lightbox lacked safe-area offsets. Mobile now exposes all doctors in normal page flow, while the desktop card keeps its compact scroll region. The lightbox uses dynamic viewport units and safe-area-aware controls and content padding. Post-fix evidence: `mobile-375-review-fixes.png` and `lightbox-mobile-375-review-fixes.png`.
5. The approved lightbox refinement replaced the opaque brand-blue canvas with a 91% charcoal surface and subtle backdrop blur. The first browser capture exposed an overly dominant initial focus ring that touched the counter. Pointer opening is now frame-free, while keyboard opening retains a quiet inset one-pixel focus ring and immediate arrow-key navigation. Mobile uses a wider 4:3 presentation frame so heterogeneous image orientations remain contained while the displayed landscape photo gains width and its caption stays visually grouped below it. Post-fix evidence: `lightbox-charcoal-91-comparison.png`, `lightbox-mobile-375-charcoal-91-pointer.png`, and `lightbox-mobile-375-charcoal-91-keyboard.png`.

## Findings

No actionable P0, P1, or P2 visual differences remain. The larger gallery button compared with the public-page source is an accepted accessibility constraint. In the lightbox, the thin carousel frame appears only for keyboard entry and is an intentional accessibility deviation from the static mock; the implementation also preserves the source photo's real aspect ratio instead of reproducing ImageGen's altered crop.

## Open Questions

- None for the selected public gallery. A separate public dark mode is not available in the current product token system; this QA covers the light public page and the gallery's dark full-screen state.

## Implementation Checklist

- [x] Preserve desktop side whitespace and the 1080 px gallery width.
- [x] Expand description to 50-55% without widening the gallery.
- [x] Keep one dominant first image and move the gallery action outside it.
- [x] Keep quality and doctors as non-overlapping 50/50 desktop cards.
- [x] Stack mobile content in the approved order.
- [x] Verify zero, one, and twelve-image states.
- [x] Verify keyboard, swipe, counter, caption, Escape, and focus return.
- [x] Verify the canonical mobile matrix and horizontal overflow.
- [x] Replace the opaque blue lightbox canvas with a 91%-opaque neutral charcoal surface.
- [x] Keep pointer entry frame-free and keyboard entry visibly focused.
- [x] Group the mobile image and caption while preserving contained image orientations.

## Follow-up Polish

No P3 visual work is required before handoff.

final result: passed
