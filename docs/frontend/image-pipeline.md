# Image pipeline

## Ownership model

Payload is the canonical media store. Seed assets and CMS uploads should preserve enough source quality for future responsive delivery variants. Payload may generate deterministic size variants such as `small`, `large`, `xlarge`, and `og`, but those variants are not the final browser-quality decision.

Next/Image owns final public delivery. Components should pass the resolved `sizes` and `quality` from `resolveMediaImage` to `next/image` so Vercel can select the right width and encode for the requesting browser and viewport.

`pnpm images:optimize` is a source-preparation and audit tool. Use it to convert oversized source files into storage-safe seed assets, check source dimensions, and catch low-quality inputs. Do not use it as a blanket final compression step before Next/Image.

## Quality policy

The allowed Next/Image qualities are centralized in `src/imageConfig.js`.

- `70`: compact listing, blog, and default app imagery.
- `75`: compatibility value for existing explicit usages.
- `85`: public landing visuals, team portraits, specialty category cards, testimonial avatars, and heroes.
- `90`: high-quality source-preparation exports where the resulting file still fits the storage budget.

Large public imagery should flow through `resolveMediaImage` with a usage-specific policy instead of hard-coding `quality` in a component.

## Source-preparation rules

Use the optimizer when raw source exports are too large for the active storage backend or when a seed asset needs a deterministic WebP derivative:

```bash
pnpm images:optimize -- --input source.png --output prepared.webp --preset teamPortrait
```

By default the optimizer does not lower width or quality to hit a byte budget. If the output is still too large, it fails and reports the size. Use a better source, increase the byte budget when the storage backend allows it, or pass `--allow-degrade` only when the visual tradeoff is explicit and acceptable.

The optimizer prints warnings for undersized or already heavily compressed sources. Treat warnings on public landing imagery as review blockers unless the source is intentionally small, such as icons or placeholders.

## Asset classes

- Team portraits: use `teamPortrait`, keep portrait crop, preserve focal point when present.
- Landing process visuals: use `landingProcess`, prefer source long edge at or above 1400px.
- Medical specialty category images: use `category`; these render as large landing cards and must not be prepared from already compressed thumbnail-like files.
- Testimonials: use `testimonialAvatar`; source can be square, but should remain clean because it may be re-encoded by Next/Image.
- Heroes: use `hero`, keep source long edge at or above 1800px.

## Validation

For code changes that affect image delivery, run:

```bash
pnpm format
pnpm check
pnpm build
```

For asset refreshes, also run a local image audit or optimizer dry-run and verify the affected routes with Playwright screenshots.
