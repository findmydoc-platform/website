# Evaluation of a Git-backed Translation Management System with a Migration Path

## Executive Judgement

The architecture you described is viable as a phase-one system and fits the "build for now, buy later" pattern well, but only if the repository is designed as a **translation source format**, not merely as a set of app-consumption files.

In practice, the Git repository should hold a canonical, vendor-neutral representation of:

- keys
- messages
- placeholders
- plural rules
- platform applicability
- filenames
- translator context

Build steps should then materialise the exact runtime formats needed by Next.js today and mobile consumers later.

If you do that, a later move to Lokalise, Crowdin, or Phrase becomes mostly a data-import and workflow-mapping exercise rather than a wholesale remodel. If you skip that discipline now and let the source of truth drift toward ad hoc nested JSON, platform-specific placeholder syntax, or giant CMS blobs, the later migration will be expensive and error-prone. citeturn8search1turn8search12turn25search0turn4search1

The strongest part of your proposal is the PR-centred review model. That pattern is already proven in Git-backed localisation tools such as GitLocalize and Weblate, where translators work in a web UI while the repository remains the source of truth and changes flow back through commits or pull requests. That is a strong signal that your chosen workflow is sound for an internal first phase.

The weak points are elsewhere:

- Payload admin scalability once you move into five figures of keys
- Git conflict handling if you use the GitHub Contents API naïvely
- the temptation to treat OTA updates for mobile as "free text pushes" without respecting App Store and Play policy boundaries

citeturn31search1turn31search0turn6search0turn28view0turn29view0

My bottom-line recommendation is to proceed, but make the internal system deliberately **TMS-shaped** from day one.

That means:

- flat, stable keys
- one canonical locale model
- sidecar metadata
- deterministic serializers
- atomic Git commits
- search-optimised Payload collections
- a CI layer that compiles consumer-specific artefacts

With those guardrails, the system is a rational short-term investment. Without them, it risks becoming a bespoke localisation platform you later have to migrate away from twice: once operationally, and once structurally. citeturn4search6turn4search0turn8search8turn6search10turn17search6

## What the Current findmydoc Stack Already Implies

The selected repository already gives you several useful signals.

The public `findmydoc-platform/website` repository is a Payload CMS and Next.js codebase, with:

- a substantial GitHub Actions footprint
- a `scripts` directory
- a documented operational structure
- `payload` with the Postgres adapter
- the official Payload search plugin already installed

That is an excellent base for a translation collection with indexed search and custom list views.

The repo also already uses many workflows in `.github/workflows`, so adding path-scoped i18n validation and export pipelines would be an incremental extension of an existing practice rather than a new organisational habit. citeturn18view0turn21view0turn24view0

Equally important, the current web app does **not** appear to have a visible Next.js i18n routing setup in `next.config.js`, and a simple search on the repository landing page does not surface an existing translation or locale subsystem.

That means you still have a clean decision point: you are not yet trapped by an incumbent i18n format or library. This is exactly the right moment to establish a canonical translation source model that is consumer-agnostic and migration-friendly. citeturn22view0turn19view0turn19view1turn19view2

There is one more useful implication. Because the repo already depends on Payload's search plugin and Postgres, I would push hard toward a **collection-based translation model** inside Payload, not a monolithic global document with thousands of localised nested fields.

Payload's own documentation emphasises:

- indexed fields
- list-searchable fields
- compound indexes
- the Select API for large list views

Those capabilities work best when translation units are modelled as queryable records with stable indexed fields such as `key`, `namespace`, `platform`, `status`, and `sourceHash`. citeturn17search0turn11search1turn7search0turn17search6

## How to Structure the Source Format for Near Plug-and-Play Migration

If the explicit goal is to keep a later migration to Lokalise almost frictionless, the safest design is to store translations in Git as **flat keys plus rich metadata**, not just as values.

I would recommend a repository layout with:

- one base-language file per namespace
- one target-language file per namespace
- one metadata sidecar per namespace in the base language

The messages should use stable dotted keys such as `comparison.filters.reset.label`, not deeply nested structural JSON.

Namespaces should reflect loading and ownership boundaries such as:

- `shared`
- `web`
- `comparison`
- later `app`

This aligns cleanly with i18next/react-i18next namespace loading, Next.js/React lazy loading patterns, and TMS concepts such as filenames and platforms. It also reduces merge conflicts and keeps web bundles smaller because modern JS i18n tools load namespaces independently. citeturn9search3turn0search7turn0search15turn9search0

The most important future-proofing move is to separate **message values** from **translation metadata**.

ARB is a good mental model here even if you do not adopt Flutter: its pattern of `key` plus `@key` metadata already captures descriptions and structured placeholder definitions. Flutter's official docs show metadata such as `description`, placeholder `type`, and placeholder `example`, and Lokalise's own ARB documentation recognises ARB as a JSON-like format with metadata for context, placeholders, and other attributes.

That is exactly the kind of information you should start storing now, even if Payload's current UI only uses part of it. citeturn25search0turn25search1

The metadata you should preserve from day one is broader than many teams expect.

At minimum, each key should carry:

- human-readable description
- domain or feature tags
- platform tags
- filename or namespace assignment
- screenshot references
- placeholder schema with name, type, example, and positional order
- character-limit or UI-length hints
- review status
- deprecation flag
- canonical source hash to detect stale translations after source changes

Lokalise's key model supports descriptions, platforms, filenames, tags, screenshots, comments, and translation statuses, so keeping analogous information now gives you a direct mapping later. citeturn8search1turn8search5turn8search9turn4search7turn8search3turn8search14

For locales, use canonical BCP 47 tags everywhere, both in Git and in CMS records. That will save you from later normalisation pain when web, Android, iOS, and TMS tooling disagree over `en`, `en-GB`, `pt-BR`, or script-specific locales.

Unicode CLDR underpins plural rules used across major platforms, and BCP 47 remains the standard grammar for language tags. citeturn4search0turn4search6turn4search13

For message syntax, your canonical source should stay as close as possible to industrial standards for plurals and placeholders. ICU MessageFormat is the broadest long-term standard and matches `next-intl` well.

There is one caveat to design around now: Lokalise explicitly notes that **named ICU placeholders are not automatically mapped to positional placeholders** when exporting across formats such as Android XML and iOS strings.

Because of that:

- record placeholder order explicitly in metadata
- preserve semantic placeholders in source
- preserve positional metadata as well
- be ready to generate platform variants or apply a deterministic mapping layer in CI for keys that need platform-native output later

citeturn4search1turn9search0turn0search10turn8search10

One subtle but important recommendation is to keep the Git repository **library-agnostic at rest**.

Do not make the repository itself:

- an i18next repo
- a next-intl repo
- a repo shaped around any specific React hook API

Instead, let the repo be a neutral message catalogue with metadata, and let build jobs create the runtime dialect each consumer needs.

That is the single best way to preserve migration flexibility, because enterprise TMS products think in terms of keys, languages, files, platforms, screenshots, statuses, and placeholders, not in terms of your React hook API. citeturn8search12turn8search13turn8search15turn31search2turn31search5

## How to Keep Payload Performant Beyond Ten Thousand Keys

The main Payload risk is not a hard product limit. Payload's localisation system itself allows many locales. The real risk is modelling.

Once you exceed roughly ten thousand keys, the wrong data shape will make the admin UI feel slow and the editor experience brittle.

Payload's own documentation points to the right levers:

- define `admin.listSearchableFields`
- index those fields
- use compound indexes for common filter combinations
- enable `enableListViewSelectAPI` so list pages fetch only active columns instead of entire documents

Those are not optional optimisations at your expected scale; they are table stakes. citeturn17search1turn11search1turn17search0turn7search16

For your use case, the best Payload schema is usually one **translation unit per document** or one **namespace-locale shard per document**, with a strong preference for one translation unit per document if translators need precise search, filtering, assignment, and review queues.

A translation-unit record can expose indexed fields such as:

- `key`
- `namespace`
- `platform`
- `status`
- `sourceText`
- `translationText`
- `sourceHash`
- `targetHash`
- `isMissing`
- `needsReview`

That lets list views and filters operate on booleans, enums, and short strings instead of scanning giant JSON payloads.

Payload's search plugin creates a separate indexed search collection containing only search-critical fields, which is particularly useful for queries like "find all incomplete German translations in comparison.* for mobile". citeturn17search6turn6search2turn11search1turn17search0

Usability matters as much as raw performance. The standard list view becomes cumbersome when translators must constantly switch views to find missing strings, stale translations, or strings with placeholder mismatches.

I would therefore treat the stock Payload list view as a base layer and add custom admin components for saved filters such as:

- Missing
- Needs review
- Changed in source
- Has screenshot

Payload is explicitly designed for custom admin components and custom endpoints, so this is consistent with the framework rather than a hack. citeturn7search2turn17search10turn6search3

A second best practice is to precompute workflow state instead of deriving it on every query.

For example, when the base string changes:

- write a new `sourceHash`
- mark all target-language siblings as `needsReview = true`
- store `changedAt`

Then translators filter on indexed booleans and timestamps rather than expensive runtime comparisons.

If the PR generation itself is non-trivial, queue it as a Payload Job rather than doing everything synchronously in the request lifecycle. Payload's jobs queue is designed for durable background work and supports retries, which is exactly what you want when a Git operation or webhook intermittently fails. citeturn7search9turn7search1turn7search13

## How to Make GitHub PR Automation Safe Under Concurrent Editing

The biggest implementation trap is using GitHub's repository Contents API as if it were a transactional document store.

GitHub explicitly warns that parallel use of the create-or-update contents endpoint will conflict and must be serialised. That is acceptable for a toy system but too fragile for a CMS where multiple editors may press "Review requested" within minutes of each other.

For production use, your Payload endpoint should create a **single atomic commit** representing all changed translation files, rather than firing many file-level content updates in parallel.

GitHub's Git Trees and Git Commits APIs exist precisely for this purpose, and the GraphQL `createCommitOnBranch` mutation adds optimistic concurrency through `expectedHeadOid`. citeturn6search0turn6search1turn6search7turn10search3

The concrete server-side pattern:

1. Read the current HEAD of the target branch.
2. Materialise all modified translation files deterministically.
3. Create one commit against that exact base SHA.
4. If the branch head has moved, fail fast.
5. Either rebase and retry automatically, or create a fresh review branch from the new head and replay the serialised changes.

This is standard optimistic locking, and GitHub's `expectedHeadOid` is a much better fit for it than file-by-file writes with ad hoc retries. citeturn10search3turn6search5turn6search10

Your JSON serialiser matters more than teams usually realise.

To reduce conflicts, every generated file should use:

- stable key ordering
- stable indentation
- stable newline handling
- one locale-plus-namespace per file

If translators edit only `de/comparison.json`, they should not touch `en/shared.json` or a giant all-locales document.

That repository shape complements GitHub's merge queue and branch protection model, which are specifically intended to keep busy branches mergeable without forcing humans to babysit every rebase. citeturn0search15turn2search3turn2search18turn10search12

There are two additional edge cases worth designing for now:

- If you eventually have hundreds of locale files in one directory, the repository Contents API becomes awkward because it has an upper limit of 1,000 files per directory; the Trees API is the safer long-term choice.
- A pull request's mergeability is not always immediately known; GitHub exposes `UNKNOWN` while mergeability is being calculated, so automation should poll rather than assuming an instant answer.

citeturn6search17turn10search1turn0search1

## How to Handle Mobile Delivery, Native Compilation, and OTA Safely

For web, the Git-based path is straightforward: merge translated JSON into the main branch, rebuild the site, and deploy.

Mobile is where the design must become more nuanced.

Expo's update system is the most mature option if you move toward React Native or Expo, because `expo-updates` and EAS Update can ship JavaScript and asset changes to installed apps without requiring a fresh app-store submission, while still using runtime versions to ensure compatibility with the native layer.

That works well for text corrections, content changes, and JS-layer fixes so long as native code remains unchanged. citeturn15search4turn15search0turn15search1turn15search11

However, the OTA story is not "anything goes".

Expo's own documentation states that you still must comply with platform and store guidelines. Apple App Review Guideline 2.5.2 says apps may not download, install, or execute code that introduces or changes app features or functionality. Google Play's Device and Network Abuse policy states that apps may not modify or update themselves outside Play's mechanism or download executable code from elsewhere, while carving out interpreted environments such as JavaScript in a webview or browser.

The safest interpretation for your use case is clear: OTA should be used for **content and reviewed JS-layer fixes**, not for materially new product functionality, and never for native-resource or native-code changes. citeturn30search2turn28view0turn29view0turn29view1

For that reason, I would separate two mobile delivery modes from the beginning:

- **Content OTA:** the app fetches signed translation manifests and JSON assets from a CDN at launch and caches them locally.
- **Bundle OTA:** EAS Update ships JS-layer changes that remain within reviewed functionality.

Content OTA is ideal for copy fixes and is lowest risk from a policy perspective because you are moving content, not changing the app binary. Bundle OTA is useful for reviewed JS-layer changes.

That distinction is not just legal hygiene; it also gives you operational clarity about what kind of release pipeline is firing. citeturn15search0turn15search4turn28view2turn29view0

On native artefact generation, I would not rely on a single "magic" GitHub Action.

Apple and Android formats differ in meaningful ways:

- Android uses `string`, `string-array`, and `plurals` in XML.
- Apple has moved toward String Catalogs and still requires plural-specific handling via `.stringsdict` or catalog equivalents.

The conversion edge cases are exactly where placeholder ordering and plural categories can go wrong.

A deterministic repository-native build step, typically a Node script or small toolchain you own, will usually be more reliable than a generic action. GitHub Actions should orchestrate this with path filters so the workflows only run when translation files change. citeturn1search7turn2search0turn2search4turn2search2turn2search13

Two practical build recommendations follow from that:

- Validate placeholders, plural categories, and locale identifiers before generating any consumer file. CLDR plural rules and ICU message syntax should be checked in CI, because broken plurals are one of the highest-value classes of localisation bug to catch automatically.
- If you later adopt Lokalise, note that Lokalise already has official GitHub Actions for pushing source files and pulling translated files as pull requests, which gives you a direct migration path from your internal PR-based workflow to a managed one.

citeturn4search0turn4search1turn5search9turn31search8

## When the Economics Flip in Favour of an Enterprise TMS

The tipping point is rarely "a certain number of keys" by itself. It is usually the moment when translation work stops being a developer-adjacent content problem and becomes an operational workflow problem.

A small internal system can remain highly economical while you are in the range of:

- roughly two to five languages
- one or two internal translators or editors
- mostly web delivery
- weekly or less frequent release waves

In that zone, Git PRs, indexed Payload collections, and disciplined JSON can absolutely outperform the complexity and cost of a full enterprise platform. citeturn31search1turn31search0turn17search6

The first warning zone starts when you combine several conditions:

- six to ten active locales
- three to five people translating or reviewing in parallel
- frequent copy changes
- both web and mobile consumers
- growing need for screenshots, terminology control, and structured review statuses

That is the point at which the "missing features" of a homegrown system stop being nice-to-haves and start consuming engineering time.

Enterprise tools are built around exactly these needs:

- glossary
- translation memory
- screenshots
- review centres
- custom statuses
- branching
- automation
- granular permissions
- translation history
- vendor collaboration

Lokalise's current documentation and plans make that explicit, and Crowdin and Phrase market the same class of capabilities. citeturn16search6turn16search12turn16search0turn16search17turn16search7turn16search5

The point where I would consider migration economically compelling is the **red zone**:

- more than about ten languages
- more than five concurrent linguists or reviewers
- routine use of external freelancers or agencies
- daily deployment pressure
- expectation of consistent terminology and auditable review across platforms

At that point, translation memory alone starts repaying licence cost, because repeated strings and near-matches become common and inconsistency becomes expensive.

The ePages case study is instructive here: even at sixteen languages, consistency itself becomes a central operational concern, not a side effect. citeturn16search17turn31search6turn16search9turn16search23

So the practical advice is this: do not wait until the internal system is "broken" before migrating. Define migration triggers now.

Good triggers would be:

- more than eight production languages
- any use of an external agency
- requirement for screenshot-rich in-context review
- weekly complaints about terminology drift
- more than one engineering day per sprint spent on localisation tooling and reconciliation work

Once two or more of those conditions hold for a sustained period, the internal system has probably crossed from "cheap control" into "hidden platform tax". citeturn16search2turn16search5turn16search6turn8search21

## Final Recommendation

Proceed with the internal Git-backed TMS, but make four decisions non-negotiable from the start:

1. Store translations in a canonical, vendor-neutral source format with sidecar metadata.
2. Model translations in Payload as indexed records rather than giant localised blobs.
3. Use atomic Git commits with optimistic locking instead of parallel file writes.
4. Treat mobile OTA as a content-and-reviewed-JS channel, not a loophole around app-store review.

If you do those four things, the architecture is not a dead end. It is a sensible phase-one operating model with a credible upgrade path to Lokalise later. citeturn6search0turn10search3turn11search1turn28view0turn29view0

Compressed into one sentence:

**Build an internal system that already looks like the export of a professional TMS, and your future migration will be mostly about switching workflow ownership instead of rewriting your localisation data model.**

That is the difference between "build now, buy later" as a strategy and "build now, rebuild later" as an accidental trap. citeturn8search1turn8search12turn31search1turn31search0

