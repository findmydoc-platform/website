# Design QA

## Source of truth

- Selected direction: Variant 1, clinic response continued inside the review card.
- Reference: Product Design artifact `exec-57b91501-b25f-4e3e-a579-a9867261b630.png` (stored outside the repository).
- Reference pixels: 1503 × 1046.
- Implementation story: `domain-clinic-templates-clinicdetail--main-initial-review-summary`.
- Browser viewport: 1536 × 1024 CSS pixels.
- Captured implementation pixels: 1521 × 1014 at density 1; the in-app browser reserves the remaining pixels for its scrollbar and frame.
- Compared state: all five verified reviews visible, with the approved clinic response attached to the latest review.

## Comparison evidence

- Full same-state contact sheet: `output/playwright/review-responses/design-contact-sheet-1536-review-fixes-final.jpg`
- Final desktop implementation:
  `output/playwright/review-responses/clinic-detail-1536-response-same-state-review-fixes-final.png`
- Focused mobile clinic response: `output/playwright/review-responses/clinic-detail-320-response-without-clinic-name.png`
- Long mobile response, collapsed:
  `output/playwright/review-responses/clinic-detail-320-long-response-collapsed-show-more-final.jpg`
- Long mobile response, expanded:
  `output/playwright/review-responses/clinic-detail-320-long-response-expanded-final.png`
- Tablet/desktop transition: `output/playwright/review-responses/clinic-detail-1024-reviews-final.jpg`

The contact sheet places the selected reference and implementation together. The clinic response keeps the selected continuation pattern: divider, clinic avatar, clinic attribution, moderation label, approval date, and response copy remain inside the originating review card. The public review hierarchy, card radius, border treatment, spacing, type scale, and existing findmydoc colors remain aligned with the current Clinic Detail design system.

## Comparison history

1. The first comparison found a dark clinic avatar and fixture copy that did not match the selected reference. The avatar was changed to the reference's light mint treatment and the approved response fixture was aligned with the selected copy.
2. The mobile comparison found that retaining the desktop avatar gutter for the response body made the 320 px text column unnecessarily narrow. The response body now uses the full card width on mobile while preserving its desktop alignment with the clinic metadata.
3. The final comparison used the same expanded five-review state as the reference. No remaining visual difference changes the selected design direction or the response-to-review relationship.
4. Reviewer follow-up covered unusually long response copy and clinic names. Mobile response copy now starts at a six-line-equivalent height and expands through a 44 px `Show more` / `Show less` control. The clinic name gets the full card width before the avatar and response metadata, avoiding fragmented long words. From 640 px onward, the response remains fully visible and the mobile control is hidden.

## Responsive and interaction QA

| Viewport    | Horizontal overflow | Result                                                                                            |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| 320 × 812   | No                  | Long clinic names use a full-width line; long responses collapse to 168 px and expand completely. |
| 375 × 812   | No                  | Long clinic response remains readable, expandable, and visually attached to the review.           |
| 640 × 900   | No                  | Full response text is visible and the mobile expansion control is hidden.                         |
| 768 × 900   | No                  | Two-column summary transition is stable.                                                          |
| 1024 × 1024 | No                  | Desktop response alignment and card boundaries remain intact.                                     |
| 1280 × 1024 | No                  | Desktop layout remains balanced.                                                                  |
| 1536 × 1024 | No                  | Same-state source comparison completed.                                                           |

- `Show more reviews` was present before activation and absent afterwards.
- The summary changed from four to five visible reviews.
- Focus moved to the newly revealed anonymous review.
- The control measured at least 44 px high at every checked breakpoint.
- The long-response control completed collapsed → expanded → collapsed with matching `aria-expanded` state.
- The collapsed response measured 168 px against a larger scroll height; the expanded response exposed the complete stored text.
- No browser console errors were recorded.
- No sticky, fixed-height, safe-area, or virtual-keyboard behavior is introduced by this section.

## Final result

passed
