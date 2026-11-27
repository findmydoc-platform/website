# ADR: Fixed language routes for the Holding landing pages

## Status

| Name   | Content    |
| ------ | ---------- |
| Date   | 27.11.2026 |
| Status | accepted   |

## Background

Holding selected the response language using the `lang` query parameter. All variants shared the same canonical URL, so search engines had no separate canonical page for each language. German is the primary language for the Website. The Turkish Holding page introduces findmydoc to clinics and has a different audience from the German and English pages.

## Considerations

Query-string variants would retain the old addresses, but language would still depend on a parameter. A separate `/holding` namespace would give the temporary mode ownership of the public URLs and require another move when Full mode takes over. Using the Website's language paths gives German and English stable addresses across that transition.

## Decision with rationale

Use `/` for German, `/en` for English, and `/tr` for the Turkish clinic introduction. Each path renders its language server-side and has its own canonical URL. German and English form the `hreflang` group, with German as `x-default`. The Turkish clinic introduction has its own sitemap entry.

Reserve `/tr` for the clinic introduction and its future Turkish successor. This reservation applies to German CMS slugs in Full mode. The Website's CMS language set continues to follow [ADR 038](./038-adr-native-payload-locale-publication.md).

## Consequences

When Full mode takes over, `/en` resolves to the native English CMS home once published. It returns a translation-unavailable page with `noindex` until then. Full mode returns 404 at `/tr` until a Turkish successor is available. Publish the successor at that URL or redirect to its Turkish canonical URL.
