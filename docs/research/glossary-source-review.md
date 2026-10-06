# Glossary source review

This review checks historical Roadmap vocabulary against the Website, Clinic Dashboard, Ops, email-template, and shared architecture contracts. Roadmap documents supply candidate terms; current contracts and code determine their meanings. The result supports the product vocabulary in [GLOSSARY.md](../../GLOSSARY.md), without copying historical implementation plans into it.

## Sources and provenance

The inspected Website branch was `1889d41a1befac85dec672971b743b765dce8760`, based on `eda78ba87601db5f00fe8c218ce1acd36e6b0b1d`. Other source snapshots were Clinic Dashboard `024553215cc7c99c80f57488b297596e1b8bb1e8`, Ops `82fc67e`, email templates `d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563`, and shared architecture `050a252`. Cross-repository links below identify those inspected revisions.

The archive rules in `docs/roadmap/AGENTS.md` mark Roadmap as historical. The candidate sources `docs/roadmap/clinic-dashboard/capability-matrix.md` and `docs/roadmap/patient-favorites/README.md` contain assessments that predate current inquiry persistence and reporting contracts. Claims about missing endpoints, unfinished work, and prototype names therefore do not establish present product behavior. Source-contract evidence also does not prove production rollout. The [paired Dashboard architecture][dashboard-architecture] retains that distinction.

## Product vocabulary supported by current sources

| Candidate | Meaning and boundary established by the sources | Evidence |
| --- | --- | --- |
| Clinic application | A clinic's participation request. Application receipt does not mean approved participation, an active staff account, or public publication. | [Participation contract](../security/clinic-participation.md), [application schema](../../src/collections/ClinicApplications.ts), [receipt template][application-receipt] |
| Clinic participation | Eligibility for clinic staff access. Approved participation can exist while the clinic remains unpublished. | [Participation contract](../security/clinic-participation.md), [Dashboard bootstrap](../integrations/clinic-dashboard-api.md#payload-bootstrap-contract) |
| Public clinic publication | Public visibility of the clinic, independently controlled from its participation and private Dashboard access. | [Dashboard bootstrap](../integrations/clinic-dashboard-api.md#payload-bootstrap-contract) |
| Inquiry | A patient-to-clinic request. A guest inquiry may exist without a conversation or read position; it is not a booking. | [Inquiry contract][inquiries], [inquiry schema](../../src/collections/PatientClinicInquiries.ts) |
| Inquiry handling status | The clinic's progress in handling an inquiry. Closing the inquiry preserves its handling status. | [Inquiry schema](../../src/collections/PatientClinicInquiries.ts), [command service](../../src/features/inquiryCommunication/service.ts), [Dashboard status model][dashboard-inquiries] |
| Inquiry lifecycle | Whether an inquiry is open or closed. Lifecycle is independent of handling status and moderation. | [Inquiry contract][inquiries], [Dashboard status model][dashboard-inquiries] |
| Inquiry read position | One staff member's personal read position. It does not change the clinic's handling status or another staff member's unread state. | [Read-position schema](../../src/collections/InquiryReadPositions.ts), [Dashboard status commands][dashboard-status] |
| Inquiry internal note | Immutable clinic-only text within an inquiry. It is separate from an external message to the patient. | [Inquiry contract][inquiries], [Dashboard timeline model][dashboard-inquiries] |
| Inquiry moderation report | A participant's report of opposite-party content. Reporting alone changes neither visibility nor messaging access. | [Inquiry moderation contract][inquiries], [report email contract][report-email] |
| Inquiry moderation appeal | A challenge to an inquiry moderation measure. An upheld appeal confirms the measure; an overturned appeal restores unchanged original content and access as defined by the contract. | [Inquiry moderation contract][inquiries], [appeal email contract][appeal-email] |
| Review response | A clinic's response to a patient review. Pending replacement text and the existing approved public response are separate projections. | [Review modification process](../review-modification-process.md), [response and appeal contract][inquiries] |
| Review appeal | A clinic's challenge to a patient review. Here, upheld means the clinic challenge was granted; the public measure remains a separate recorded decision. | [Review modification process](../review-modification-process.md), [response and appeal contract][inquiries] |
| Review public measure | The selected public treatment of review content. Approval status and author withdrawal are independent controls. | [Review modification process](../review-modification-process.md), [Dashboard review model][dashboard-reviews] |
| Review author withdrawal | Author-requested logical withdrawal. Public output and rating contribution stop, while protected records and history remain. | [Review modification process](../review-modification-process.md), [Dashboard review model][dashboard-reviews] |
| Clinic profile draft | The clinic's persistent unpublished edits to the contract-owned profile fields. Saving a draft does not publish it. | [Profile draft contract](../integrations/clinic-dashboard-api.md#clinic-profile-draft-contract), [Dashboard profile source][dashboard-profile] |
| Clinic profile gallery | The saved ordered gallery for the public clinic profile; the first image is the main image. An uploaded private draft medium becomes published only through gallery save. | [Gallery contract](../integrations/clinic-dashboard-api.md#clinic-gallery-contract) |
| Public profile completion | Completion of six published-profile areas. The draft editor separately checks four required field groups for publication readiness. Neither calculation rates medical quality. | [Website reporting implementation](../../src/features/clinicDashboard/reporting/service.ts), [Dashboard published progress][dashboard-progress], [draft completeness][dashboard-draft-completeness] |
| Medical specialty | A named medical specialty with the enforced two-level hierarchy. It is separate from a central treatment definition and a clinic's treatment offering. | [Specialty schema](../../src/collections/MedicalSpecialties.ts), [hierarchy rule](../../src/collections/MedicalSpecialties/hooks/enforceTwoLevelHierarchy.ts), [treatment contract](../integrations/clinic-dashboard-api.md#clinic-treatment-contract) |
| Conversation message notification | A transactional notification of a workflow event. A conversation notification omits protected message content and is separate from the stored conversation message. | [Conversation email contract][conversation-email], [email ownership contract][auth-email] |

The two appeal workflows require explicit names. Their `upheld` states have different meanings. Likewise, the general phrase "profile completeness" obscures the distinction between public reporting and draft publication readiness.

## Operations vocabulary in its own context

Ops contains stable release and audit terms. These describe platform operations rather than patient-clinic interactions; they do not establish availability of a product feature.

| Candidate | Operations meaning | Evidence |
| --- | --- | --- |
| Platform release | One coordinated platform version spanning Website and Clinic Dashboard. | [Release contract][ops-release] |
| Application release | A release belonging to one application. Import can reconcile an already published release without deploying it again. | [Release contract][ops-release] |
| Release plan | The frozen release input binds application commits, trusted Ops revision, reconciliation workflow, and managed configuration scope to a stable digest. | [Release contract][ops-release] |
| Release manifest | Canonical manifest bytes shared identically by both applications. | [Release contract][ops-release] |
| Release change | A business change associated with one or more PRs; the content model assigns each PR exactly once. | [Release content contract][ops-content] |
| Release visual | A selected screenshot candidate for release content. QA evidence alone is not release-image approval. | [Release content contract][ops-content] |
| Audit bundle | Redacted operation/run metadata and checksums, separate from the durable release archive. | [Ops README][ops-readme] |

The shared architecture already has a [technical glossary][architecture-glossary]. Payload, BFF, Supabase, and other system-boundary terminology remain there rather than being repeated as product concepts.

## Email boundaries and excluded candidates

The template package owns presentation; applications own routing, links, and delivery. A template-package release and Website adoption are separate events. The [auth-action contract][auth-email] distinguishes patient email verification from medical identity verification, and staff password setup from clinic approval. These distinctions support existing product terms without adding generic password-recovery or template-component terminology.

The [appeal email contract][appeal-email] describes inquiry moderation appeals, not appeals against public patient reviews. Its exports exist in the inspected package even though introductory/export documentation is older. The inspected template-package sources do not establish a central event-to-template registry or application delivery-state model.

The Dashboard [notification fixture][dashboard-notifications] is demo data. The proposed notification center does not establish an implemented persistent notification feature, so it contributes no glossary definition. Schema-only [clinic verification levels](../../src/collections/Clinics.ts) lack a supported medical-quality meaning. Disabled [before/after gallery entries](../../src/collections/ClinicGalleryEntries/index.ts), historical prototype names such as "Clinic Plan", generic UI components, and rollout promises are excluded.

[inquiries]: ../integrations/clinic-dashboard-api.md
[dashboard-architecture]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/docs/authentication-and-bff.md
[dashboard-inquiries]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/messages/model/inquiries.ts
[dashboard-status]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/messages/model/inquiry-status-commands.ts
[dashboard-reviews]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/reviews/model/review-source.ts
[dashboard-profile]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/clinic-profile/model/clinic-profile-source.ts
[dashboard-progress]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/dashboard/model/profile-progress.ts
[dashboard-draft-completeness]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/clinic-profile/model/clinic-profile-completeness.ts
[dashboard-notifications]: https://github.com/findmydoc-platform/clinic-dashboard/blob/024553215cc7c99c80f57488b297596e1b8bb1e8/src/features/clinic-dashboard/demo/dataset.ts
[ops-release]: https://github.com/findmydoc-platform/ops/blob/82fc67e/docs/platform-release.md
[ops-content]: https://github.com/findmydoc-platform/ops/blob/82fc67e/.codex/skills/platform-release/references/release-content.md
[ops-readme]: https://github.com/findmydoc-platform/ops/blob/82fc67e/README.md
[architecture-glossary]: https://github.com/findmydoc-platform/platform-architecture/blob/050a252/12_glossary.md
[application-receipt]: https://github.com/findmydoc-platform/transactional-email-templates/blob/d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563/packages/email-templates/src/templates/ClinicRegistrationReceiptEmail.tsx
[auth-email]: https://github.com/findmydoc-platform/transactional-email-templates/blob/d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563/docs/auth-action-email-contract.md
[conversation-email]: https://github.com/findmydoc-platform/transactional-email-templates/blob/d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563/docs/conversation-message-email-contract.md
[report-email]: https://github.com/findmydoc-platform/transactional-email-templates/blob/d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563/docs/report-moderation-email-contract.md
[appeal-email]: https://github.com/findmydoc-platform/transactional-email-templates/blob/d8724c8ff11cbd0fce44a2ab4f4c5b66cd4a9563/docs/appeal-moderation-email-contract.md
