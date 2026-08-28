# Semantic Anchor Coverage

## Purpose

This record separates established methods from Website-specific contracts. `AGENTS.md` files name the methods. Local instructions continue to define repository paths, ownership, exceptions, validation matrices, and evidence thresholds.

## Catalog Status

The current [Semantic Anchors catalog](https://llm-coding.github.io/Semantic-Anchors/llms.txt) has dedicated entries for London School TDD and Hexagonal Architecture. It references Information Hiding and the Dependency Rule through related architecture entries. The remaining adopted names do not have dedicated catalog entries, so their primary sources establish the method and the repository keeps concrete behavior explicit.

The [evaluation guidance](https://llm-coding.github.io/Semantic-Anchors/evaluations/) treats recognition and consistency as model-dependent. An anchor's presence in this repository does not prove behavioral equivalence across models.

## Coverage Decisions

| Anchor | Primary source | Reliably covers | Does not cover | Residual doubt and retained contract |
| --- | --- | --- | --- | --- |
| Freeman and Pryce's Outside-In TDD | [Growing Object-Oriented Software](https://growing-object-oriented-software.com/) | Driving development from observable behavior toward collaborators | Test quality, test-first chronology, or repository exclusions | Keep chronology evidence, docs and configuration exclusions, Vitest and Playwright paths, and false-confidence review rules. |
| Kent Beck's Test Desiderata | [Test Desiderata](https://medium.com/@kentbeck_7670/test-desiderata-94150638a4b3) | Named test qualities and their tradeoffs | Test selection, tooling, or the Outside-In process | Keep behavior-risk evidence, tradeoff reporting, and the repository sense check. |
| Parnas's Information-Hiding Criterion | [On the Criteria To Be Used in Decomposing Systems into Modules](https://doi.org/10.1145/361598.361623) | Hiding change-prone design decisions behind module interfaces | Repository folders or Payload ownership | Keep the Website module and adapter boundaries. |
| Robert C. Martin's Dependency Rule | [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) | Source dependencies pointing toward higher-level policy | Which local module owns that policy | Keep route, block, and reusable UI ownership explicit. |
| Luke Wroblewski's Mobile First | [Mobile First](https://www.lukew.com/resources/mobile_first.asp) | Prioritizing content and interaction at narrow viewports | Breakpoints, viewport matrices, or browser verification | Keep the full mobile QA and runtime evidence contract. |
| Ethan Marcotte's Responsive Web Design | [Responsive Web Design](https://alistapart.com/article/responsive-web-design/) | Flexible layouts, flexible media, and media-query behavior | Product priority, fixed breakpoints, or short-height behavior | Keep the viewport matrix, responsive image checks, and short-height cases. |
| WCAG 2.2 AA | [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) | Applicable Level A and Level AA success criteria | Repository components, form APIs, or proof format | Keep Button, UiLink, Heading, form error, runtime evidence, and severity rules. |
| WAI-ARIA Modal Dialog Pattern | [Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Modal dialog semantics, keyboard behavior, and focus behavior | Non-modal UI, viewport containment, or the local dialog wrapper | Keep short-height, interaction-cycle, and runtime checks. |
| Component-Driven Development through Storybook | [Storybook tutorial](https://storybook.js.org/tutorials/intro-to-storybook/react/en/simple-component/) | Developing and composing UI in isolated component states | File location, metadata, mocks, or colocation | Keep Storybook isolation, governance, and runtime evidence rules. |
| Component Story Format | [CSF documentation](https://storybook.js.org/docs/api/csf/) | The portable story module format | Colocation or repository title and lifecycle tags | Keep Autodocs, title, tag, and usage metadata contracts. |
| Hexagonal Architecture | [Alistair Cockburn's Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture) | Keeping outside dependencies behind ports and adapters | Payload directories, prop shapes, or existing exceptions | Keep Payload as source of truth, route and block adapters, normalized props, callback ports, import bans, and the ClinicDetail transition exception. |
| Atomic Design | [Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/) | Hierarchical component composition | Repository directories, aliases, Payload boundaries, or story tags | Keep the local layer folders, responsibilities, aliases, and metadata mapping. |

## Local Contracts That Remain Explicit

- Mobile viewports `320`, `375`, `640`, `768`, and `1024`, with conditional `1280` coverage.
- Short-height, browser-engine, real-route, worst-case content, and complete interaction-cycle evidence.
- Vitest, Playwright, test-first chronology, behavior-risk, and test sense-check rules.
- Payload and application API ownership in route and block adapters, with normalized props and callback ports for reusable UI.
- Atomic Design directories, aliases, layer responsibilities, and Payload-free components.
- Storybook colocation, central fixture and MDX ownership, story-only prototype paths, metadata, mocks, and play-function expectations.
- Button, UiLink, Heading, public form validation, accessibility evidence, and severity contracts.
