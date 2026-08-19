# Architecture Semantic Anchor Candidates

## Research question

Which established architecture methods can accurately compress or structure recurring Website instructions about
boundaries, dependency direction, feature ownership, server/client trust, and durable decisions?

This report evaluates four independently attributable methods. It does not select a repository-wide architecture or
authorize instruction changes. The later decision should compose methods only where they govern distinct concerns.

## Evaluation frame

The [Semantic Anchors quality criteria](https://llm-coding.github.io/Semantic-Anchors/about/#_quality_criteria) require
an anchor to be precise, rich, consistent, and attributable. Inclusion in that catalog is explicitly a lexical quality
judgment, not an endorsement of the method. This report therefore separates two questions:

1. Is the term a viable Semantic Anchor?
2. Does the current Website repository implement enough of the method for that anchor to replace prose safely?

The second threshold is stricter. A well-known method can still be the wrong shorthand for this repository.

## Current repository evidence

The Website is a single Payload CMS and Next.js App Router application. Its instructions make Payload the source of
truth, keep presentational UI independent of Payload types, and place translation in block or route adapters
([`src/AGENTS.md`](../../../src/AGENTS.md#L13-L27)). Route instructions repeat that Payload shapes must terminate at an
adapter and that reusable UI receives normalized props ([`src/app/AGENTS.md`](../../../src/app/AGENTS.md#L9-L18),
[`src/blocks/AGENTS.md`](../../../src/blocks/AGENTS.md#L9-L18)). These are real boundary rules, but the repository does
not declare a framework-independent application core or named port interfaces.

Feature-local organization exists selectively. For example, `src/features/clinicDashboard/**` groups bootstrap,
profile, treatment, and gallery contracts and services by capability, while Payload handlers remain under
`src/endpoints/**`, collection concerns under `src/collections/**`, and shared authorization under `src/access/**`.
The profile slice co-locates its input schemas and DTOs
([`profile/contracts.ts`](../../../src/features/clinicDashboard/profile/contracts.ts#L1-L40)) with its workflow service
([`profile/service.ts`](../../../src/features/clinicDashboard/profile/service.ts#L1-L30)). The repository is therefore
partly feature-oriented and partly framework/layer-oriented.

The Clinic Dashboard integration already has an explicit cross-repository trust boundary. The Website owns Payload
authentication, business authorization, endpoints, and DTO contracts; the Dashboard owns its BFF, session cookies,
Route Handlers, and UI-facing error states
([`clinic-dashboard-api.md`](../../integrations/clinic-dashboard-api.md#L3-L15)). The accepted decision narrows the BFF
to same-origin, capability-specific routes while Payload remains the business authorization and persistence boundary
([ADR 026](../../adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md#L144-L185)).

Finally, the repository already maintains sequential Architecture Decision Records, statuses, rationale, alternatives,
and supersession links ([ADR index and process](../../adrs/README.md#L1-L48)). This is an implemented governance method,
not merely an analogy.

## Candidate comparison

| Candidate | Primary concern | Anchor quality | Repository fit | Advance to decision ticket |
| --- | --- | --- | --- | --- |
| Ports and Adapters / Hexagonal Architecture | Inside/outside boundary and technology adapters | Strong | Partial at the Payload/UI boundary | Yes, as a scoped smoke-test candidate only |
| Vertical Slice Architecture | Coupling and ownership along a feature/use-case axis | Strong term; moderate interpretation risk | Partial under `src/features/**` | Yes, as a scoped smoke-test candidate only |
| Backend for Frontend | One UI-specific server edge inside the perimeter | Strong | Strong for the accepted Clinic Dashboard integration | Yes, but never as a security shorthand |
| Architecture Decision Record | Durable context, decision, status, and consequences | Strong | Strong and already implemented | Yes, as the default decision-record anchor candidate |

## 1. Ports and Adapters / Hexagonal Architecture

### Canonical name and origin

Alistair Cockburn's 2005 pattern is named **Ports and Adapters**, with **Hexagonal Architecture** as its alternative
name. The original paper defines a port as a purposeful application conversation and an adapter as the
technology-specific translation between that port and an external device
([Cockburn, “Hexagonal Architecture”](https://alistair.cockburn.us/hexagonal-architecture/)).

### Meaning and boundary

The method separates the application from external drivers and infrastructure so the same application conversation can
be driven by a UI, automated test, HTTP adapter, or batch process and can use replaceable database-side adapters. Its
primary distinction is **inside versus outside**, not horizontal folder layering.

It must remain distinct from Vertical Slice Architecture. Ports and Adapters governs how an application communicates
across technology boundaries; Vertical Slice Architecture governs how change is grouped by use case. It also does not,
by itself, define which system is authoritative, which concrete directories are allowed to import framework types, or
which security checks apply.

### Semantic Anchor assessment

- **Precise:** Yes. Cockburn names the pattern, intent, ports, adapters, and inside/outside boundary.
- **Rich:** Yes. The term activates application isolation, purposeful APIs, multiple driving/driven adapters, and
  replaceable infrastructure.
- **Consistent:** Yes for the core pattern. The Semantic Anchors catalog itself uses Hexagonal Architecture as its
  positive precision example. Implementations still differ in how literally they model ports.
- **Attributable:** Yes. The method and original publication are attributable to Alistair Cockburn.

### Website fit

The Payload/UI boundary resembles a narrow Ports and Adapters application: block and route adapters translate
Payload-owned shapes into stable, presentation-oriented contracts, and reusable components must not depend on Payload
types ([`src/AGENTS.md`](../../../src/AGENTS.md#L19-L27)). The block instructions even use the repository's adapter
terminology explicitly ([`src/blocks/AGENTS.md`](../../../src/blocks/AGENTS.md#L9-L18)).

The fit is not repository-wide. Payload is intentionally the server truth and much business behavior is expressed
through Payload collections and hooks ([`src/AGENTS.md`](../../../src/AGENTS.md#L29-L38)); the repository does not expose
an independent inner application with named ports. A bare instruction such as “use Hexagonal Architecture” could cause
unrequested interfaces, repositories, or framework extraction.

### What must remain explicit

- Payload remains the source of truth.
- The exact boundary is Payload-aware route/block adapters versus Payload-free presentational components.
- The allowed adapter locations and normalized UI contract shapes remain repository-local facts.
- Access, cache, and migration rules remain explicit; the pattern does not supply them.

### Evidence limit and confidence

**Confidence: medium-high.** The method is unambiguous and the UI adapter fit is concrete, but calling the entire
application hexagonal would overstate the current structure.

## 2. Vertical Slice Architecture

### Canonical name and origin

Jimmy Bogard's 2018 description of **Vertical Slice Architecture** organizes code around distinct requests or use cases.
It maximizes coupling within a slice, minimizes coupling between slices, and couples code along the axis of change
([Bogard, “Vertical Slice Architecture”](https://www.jimmybogard.com/vertical-slice-architecture/)).

### Meaning and boundary

The method groups the concerns needed to deliver one behavior rather than forcing every request through identical
horizontal layers. It does not mean “put every file in one folder,” and it is not synonymous with CQRS, MediatR, or
Ports and Adapters. Bogard presents command/query requests as his context, but the organizing rule is the use-case slice
and its change coupling.

Vertical Slice Architecture also must not erase genuine shared policies. Authorization helpers, Payload collection
registration, cache policy, and reusable UI can remain cross-cutting owners when the repository has already assigned
them that role.

### Semantic Anchor assessment

- **Precise:** Yes. The primary source states the unit of organization and coupling rule.
- **Rich:** Yes. It activates use-case boundaries, end-to-end change locality, slice cohesion, and low inter-slice
  coupling.
- **Consistent:** Moderate. The core definition is stable, but common usage often bundles CQRS or mediator libraries
  that are not part of the minimum organizing rule.
- **Attributable:** Yes. The named formulation and definition are attributable to Jimmy Bogard.

### Website fit

`src/features/clinicDashboard/**` is a concrete partial fit: each capability groups contracts and services, and the
Payload handler delegates to the feature workflow
([`clinicDashboardBootstrap.ts`](../../../src/endpoints/clinicDashboardBootstrap.ts#L1-L35),
[`bootstrap.ts`](../../../src/features/clinicDashboard/bootstrap.ts#L9-L38)). Other `src/features/**` areas similarly
group public discovery, runtime policy, favorites, and search-indexing behavior.

The repository is not uniformly vertical. Next.js routes, Payload collection registration, UI component layers,
shared hooks, and access helpers retain intentional framework or horizontal ownership. A blanket Vertical Slice anchor
could contradict the existing path-local instruction hierarchy and trigger broad moves unrelated to the requested
change.

### What must remain explicit

- Name the feature or use case that constitutes the slice.
- Preserve framework-owned entry points and the existing Payload/UI boundary.
- Reuse central access, cache, and component contracts instead of copying them into a slice.
- State that no repo-wide relocation or CQRS/MediatR adoption is implied.

### Evidence limit and confidence

**Confidence: medium.** Feature-local code provides a credible pilot surface, but the repository's hybrid organization
means the anchor needs a narrow scope and a smoke test against relocation or abstraction drift.

## 3. Backend for Frontend

### Canonical name and origin

Sam Newman's 2015 pattern write-up attributes the term **Backend for Frontend (BFF)** to former SoundCloud engineer Phil
Calçado. It defines one server-side backend per user experience, maintained with and tightly focused on that UI
([Newman, “Backends for Frontends”](https://samnewman.io/patterns/architectural/bff/)).

Next.js now documents explicit BFF support through public Route Handlers and other server capabilities, while warning
that those capabilities are not a full backend replacement
([Next.js BFF guide](https://nextjs.org/docs/app/guides/backend-for-frontend)).

### Meaning and boundary

A BFF is a UI-specific server edge inside the perimeter, not a general-purpose API gateway and not a generic proxy.
Newman's definition ties it to a particular user experience and team. The pattern can reshape or aggregate backend
capabilities for that UI.

The term is not a security policy. Next.js states that Route Handlers are public HTTP endpoints and requires explicit
authentication and authorization for protected access
([Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication#route-handlers)). A BFF anchor cannot
infer the Website's principal derivation, CSRF, origin, cookie, cache, projection, or failure contracts.

### Semantic Anchor assessment

- **Precise:** Yes. The canonical problem, UI-specific backend, and contrast with a general-purpose gateway are clear.
- **Rich:** Yes. It activates UI-specific contracts, team ownership, perimeter placement, aggregation, and release
  autonomy.
- **Consistent:** High for the UI-specific edge; moderate for security implications, which the pattern does not define.
- **Attributable:** Yes. The term is attributed to Phil Calçado and the established pattern write-up to Sam Newman.

### Website fit

The fit is strong but narrow. ADR 026 already selects a same-origin Dashboard BFF with capability-specific routes and
rejects direct browser-to-Payload access and a generic proxy
([ADR 026](../../adrs/026-adr-standalone-clinic-dashboard-bff-architecture.md#L119-L160)). The integration contract makes
the repository ownership split explicit and requires Website-derived principal, clinic, and capability data
([`clinic-dashboard-api.md`](../../integrations/clinic-dashboard-api.md#L28-L51)).

The BFF runtime lives in the Clinic Dashboard repository, not this Website repository. Within the Website, the term is
appropriate when reasoning about the accepted cross-repository contract; it is not a general label for all Payload or
Next.js routes.

### What must remain explicit

- The Dashboard browser never calls Payload directly; routes are same-origin and capability-specific.
- Payload remains the authoritative business authorization, tenant, and persistence boundary.
- The Website and Dashboard repository ownership split remains explicit.
- Authentication, authorization, input, origin, CSRF, secure-cookie, DTO projection, no-store, and failure semantics
  remain explicit and source-linked.
- Generic Payload proxying remains prohibited.

### Evidence limit and confidence

**Confidence: high** for using BFF as the architecture label in the already accepted integration. **Confidence: low**
for using it to compress any security or trust-boundary invariant.

## 4. Architecture Decision Record

### Canonical name and origin

Michael Nygard's 2011 **Architecture Decision Record (ADR)** proposal defines a short repository text file for one
architecturally significant decision. The record preserves title, context, decision, status, and consequences, keeps
superseded records, and focuses on structure, non-functional characteristics, dependencies, interfaces, or construction
techniques
([Nygard, “Documenting Architecture Decisions”](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

### Meaning and boundary

An ADR records why one significant project decision was made and what follows from it. It is not the decision method,
an implementation plan, an always-current runtime guide, or an architecture pattern. Saying “write an ADR” does not
select Ports and Adapters, BFF, Vertical Slice Architecture, or any other outcome.

### Semantic Anchor assessment

- **Precise:** Yes. The artifact, significance threshold, lifecycle, and core fields are defined.
- **Rich:** Yes. It activates context, forces, decision, status, consequences, and supersession history.
- **Consistent:** High. The repository already follows the same recognizable record family.
- **Attributable:** Yes. The lightweight ADR format is attributable to Michael Nygard's 2011 proposal.

### Website fit

This is the strongest current fit. The repository has an indexed ADR collection, statuses, a template, rationale and
alternative expectations, and explicit supersession guidance ([`docs/adrs/README.md`](../../adrs/README.md#L1-L48)).
Architecture-sensitive instructions already stop for an ADR when a change would introduce a new cache class, route
family, owner type, or cache primitive ([`src/AGENTS.md`](../../../src/AGENTS.md#L40-L45)).

The local template is more detailed than Nygard's minimum form. Therefore the anchor can identify the artifact class,
but the repository template and current accepted records remain authoritative for local structure and status.

### What must remain explicit

- The local trigger for an architecturally significant decision or stop condition.
- The repository location, next number, template, accepted status vocabulary, and index update.
- The exact accepted ADR that governs the current task.
- Required supersession links and the distinction between an ADR, a plan, and runtime documentation.

### Evidence limit and confidence

**Confidence: high.** The method is attributable and already implemented. The remaining risk is using the acronym alone
without routing the agent to the repository's local ADR process and applicable accepted record.

## Recommendation for the later decision ticket

Advance all four terms, but not as one architecture bundle:

1. **Advance Architecture Decision Record directly** as the strongest repository-native Semantic Anchor candidate.
2. **Advance Backend for Frontend only for the existing Clinic Dashboard integration**, paired with explicit security,
   ownership, and trust contracts that must not be compressed.
3. **Advance Ports and Adapters to a smoke test only at the Payload/UI translation boundary.** Reject any wording that
   implies the whole application has a framework-independent hexagonal core.
4. **Advance Vertical Slice Architecture to a smoke test only for named `src/features/**` workflows.** Reject any wording
   that implies repo-wide relocation, CQRS, or mediator adoption.

The later decision should compare each scoped anchor against the current explicit instruction using one frozen repo
case. Passing requires correct method application, no confusion with the adjacent methods above, preservation of every
repository-specific invariant, equal or better usefulness, and material prompt reduction. BFF security and Payload
authority statements should be treated as non-compressible even if the architecture label passes.

## Source set

- [Semantic Anchors: About and quality criteria](https://llm-coding.github.io/Semantic-Anchors/about/)
- [Alistair Cockburn: Hexagonal Architecture / Ports and Adapters](https://alistair.cockburn.us/hexagonal-architecture/)
- [Jimmy Bogard: Vertical Slice Architecture](https://www.jimmybogard.com/vertical-slice-architecture/)
- [Sam Newman: Backends for Frontends](https://samnewman.io/patterns/architectural/bff/)
- [Next.js: Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Next.js: Authentication and Route Handler authorization](https://nextjs.org/docs/app/guides/authentication#route-handlers)
- [Michael Nygard: Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
