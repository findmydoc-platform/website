# Review Modification Process

## Purpose and Policy Boundary

This document describes the implemented technical process for review corrections, clinic responses, clinic appeals,
public moderation, and author withdrawal. It does not define which statements require a policy intervention. The
internal Trust Core remains the source of truth for those decisions and must be consulted without duplicating
its private contents here.

findmydoc is not an evidence platform. Review workflows must not request or store proof uploads, passage-level or
evidence fields, raw medical records, screenshots, or personally identifiable information about third parties.
`ReviewAppeals.details` is a short description of the clinic's objection, limited to 10-2000 characters. An external
case or file reference is not required.

## Domain Contract

| Record | Implemented responsibility |
| --- | --- |
| `Reviews` | Stores the author's original `comment`, approval `status`, public moderation projection, withdrawal state, and unlimited native Payload versions. |
| `ReviewResponses` | Stores one moderated clinic-response workflow per approved review, with separate pending and published projections and unlimited native versions. |
| `ReviewAppeals` | Stores at most one non-public clinic appeal per approved review, its decision lifecycle, and unlimited native versions. |

The three review concerns are independent:

- `status` is the existing approval state: `pending | approved | rejected`.
- `publicMeasure` controls the public treatment of an approved review:
  `none | context | redaction | placeholder | removed`.
- `withdrawalState` records whether the author withdrawal is `active | withdrawn`.

An appeal decision does not set either of the other states. In particular, `upheld` does not automatically reject,
remove, redact, or otherwise change a review or its clinic response.

## Roles and Tenant Scope

| Principal | Review access and actions |
| --- | --- |
| Anonymous caller | Reads only approved, active public review projections and eligible published clinic responses. |
| Patient | Creates a review that is forced to the authenticated patient and `pending`; reads the same public projection as an anonymous caller; can withdraw only their own review. Patients cannot directly update, delete, or read review versions. |
| Clinic staff | Reads approved reviews for the currently assigned clinic, including sanitized moderation and withdrawal state; manages only that clinic's response and appeal workflows; reads tenant-scoped response and appeal versions and the sanitized review publication history. Clinic staff cannot moderate or withdraw reviews. |
| Platform staff | Reads all review states and raw history; performs ordinary Review updates and public moderation; records author withdrawal after external support verification; corrects withdrawal state; moderates clinic-authored response workflows without editing the pending text; and submits or decides appeals. Review deletion is platform-only and uses Payload soft delete. |

For response and appeal writes, the clinic is derived from the related review and checked against the authenticated
clinic assignment. A clinic or actor supplied by a client is not authoritative. Cross-tenant workflow reads are
filtered, and the review publication-history endpoint returns `404` for an assigned clinic that does not own the
review.

## Submission and Approval

Patients and platform staff can create reviews. Patient creation always derives the patient from the authenticated
principal and forces `status=pending`. Platform staff controls ordinary Review updates, including approval or
rejection. Only approved reviews can enter the clinic response or appeal workflows.

Public output requires an approved, non-deleted, active review and a public measure other than `removed`. A pending or
rejected review is not public, regardless of its moderation fields.

## Verified Author Corrections

### Operator Policy

Patients do not edit a submitted review directly. A patient requests a correction through support, and platform staff
verifies outside the Website backend that the request came from the review author. Only that externally verified
request permits an operator to change the original `comment`.

Platform, legal, or clinic moderation must not overwrite `comment`. The dedicated moderation command writes only the
public projection and its audit fields. A redaction therefore stores a separate readable `publicComment`; context adds
a separate notice; placeholder and removal hide text without replacing the original. Withdrawal also leaves
`comment` unchanged.

### Technical Guarantee

Platform staff applies an author correction through the ordinary platform-only Review update. Payload records the
previous and updated text as native versions, and the Review edit hook records `lastEditedAt`, `editedBy`, and
`editedByName`.

The Website backend has no dedicated author-correction command, verification flag, stored verification evidence, or
purpose field for that update. The edit metadata establishes which platform account made an update and when; it does
not prove that the author approved the change or that the update was used for an author correction. External support
verification and correct operator use therefore remain policy obligations.

## Clinic Response Workflow

Each approved review can have one `ReviewResponses` record:

1. Assigned clinic staff submits or edits `pendingResponse`.
2. Platform staff reads the current clinic submission and manages only its moderation status and reason.
3. An already approved response remains public while a revision is pending.
4. Platform staff sets `moderationStatus` to `approved`, `rejected`, or `blocked`.
5. Approval publishes the pending response. Rejection discards the pending replacement but retains an existing
   published response. Blocking hides the published response.

A published, non-blocked response is public only while its parent review remains approved, active, and readable under
`none`, `context`, or `redaction`. It is hidden when the parent Review is rejected, soft-deleted, withdrawn, or assigned
`placeholder` or `removed`.

## Clinic Appeal Workflow

Each approved review can have at most one `ReviewAppeals` record for its lifetime:

1. Assigned clinic staff, or platform staff recording the submission, selects a reason and submits the short `details`
   description.
2. The clinic submission is immutable after creation.
3. Platform staff moves the appeal through `submitted -> under_review -> upheld | dismissed` and provides a
   `decisionReason` for a terminal decision.
4. Before an appeal can become `upheld`, platform staff must record a separate public moderation action after the
   appeal was submitted. `none` is the explicit decision that no public change is required.
5. The terminal appeal update changes only the appeal. It does not create a Review or ReviewResponse version and does
   not alter either record's public state.

The appeal's `under_review` state is private workflow data. It is never rendered as a public review status.

## Public Moderation Measures

The following table assumes `status=approved`, `withdrawalState=active`, and no soft deletion. “Public author” means
the first-name and last-initial snapshot only when the patient opted into that display.

| Measure | Public review output | Stars, count, date, and public author | Published clinic response |
| --- | --- | --- | --- |
| `none` | Original `comment` | Included | Visible when independently approved and non-blocked |
| `context` | Original `comment` plus a factual operator-provided `publicNotice` | Included | Visible when independently approved and non-blocked |
| `redaction` | Separate readable `publicComment` plus the fixed removal notice | Included | Visible when independently approved and non-blocked |
| `placeholder` | Fixed neutral notice; no review text | Included | Hidden |
| `removed` | Review omitted without a placeholder | Excluded | Hidden |

Redaction produces ordinary readable text, not black bars. Placeholder is an operationally temporary measure for cases
where no coherent text can remain visible while the final measure is completed. It is not a public `under_review`
state; platform staff must replace it with the final measure. The current command contract does not schedule or expire
placeholders automatically.

For `redaction`, platform staff supplies `publicComment`, while the moderation command leaves the stored original
`comment` unchanged. The backend does not compare `publicComment` with `comment`; it therefore does not guarantee that
the public text is deletion-only or that it preserves the meaning of the original. Before selecting `redaction`, the
operator must compare both texts and confirm that only the necessary passages were removed and that the remaining
content does not distort the original statement.

The moderation process stores no passage selection, text diff, evidence field, or proof for that decision. The fixed
public removal notice is an operator-responsible statement, not the result of automated text analysis. The moderation
command records the internal reason, platform actor, and timestamp. It preserves the Review's `comment`, star rating,
approval status, review date, and author preference. A withdrawn review rejects further moderation until platform
staff corrects an erroneous withdrawal.

Current collection reads apply the same visibility boundary:

- Platform staff can read all states, raw text, internal reasons, and audit actors.
- Assigned clinic staff current reads retain approved rows for their clinic even when `publicMeasure=removed` or
  `withdrawalState=withdrawn`. They can read the stored `publicMeasure`, `publicComment`, and `publicNotice` when
  present, plus `moderatedAt`, `withdrawalState`, `withdrawalSource`, and `withdrawnAt`. Those stored fields do
  not mean that the row or projection is still public. Raw `comment` is available only for active `none` or
  `context` reviews; it is not readable for redaction, placeholder, removal, or withdrawal. Patient identity,
  internal reasons, and named audit actors are also omitted.
- Patients and anonymous callers receive only approved, active `none | context | redaction | placeholder` rows. They
  receive the public projection only. Removed and withdrawn rows are absent in full.

## Author Withdrawal

Withdrawal is a dedicated state change, not review deletion or text editing:

1. The owning patient can invoke the withdrawal command for their own review. An unrelated patient receives no
   confirmation that the review exists.
2. Platform staff may document an author withdrawal only after support has verified the request outside the Website
   backend. The platform request must include an internal reason, but the backend stores no verification proof.
3. Repeating an already completed withdrawal is idempotent and creates no additional version.
4. Withdrawal removes the review, star contribution, clinic response, and any future published patient additions from
   public output without a placeholder.
5. The command appends source, actor, time, reason, and withdrawal state to native history. Those fields establish who
   recorded the state change and when; they do not prove an externally verified author request. The command does not
   overwrite the original `comment`, change the existing public measure, or delete the Review record and its versions.

Withdrawal is terminal until platform staff uses the audited withdrawal-correction command. That correction restores
`withdrawalState=active` and preserves the existing public measure; it does not rewrite the review.

## Versioning and Audit

- `Reviews`, `ReviewResponses`, and `ReviewAppeals` retain unlimited native Payload versions. Version restoration is
  disabled for all three collections.
- Raw Review versions are platform-only. Assigned clinic staff use the sanitized publication-history endpoint, which
  reveals historical public text, notices, and author name only when they exactly match the currently safe public
  projection. Removed or withdrawn current state exposes no historical text.
- Response and appeal versions are readable by platform staff and by clinic staff for their assigned clinic. Public
  and patient principals cannot read them.
- Response and appeal mutations record action, timestamp, actor type, and an optional actor relation. Account erasure
  can clear the personal actor relation from current and version records while the non-personal action audit remains.
- Moderation records `moderationReason`, `moderatedAt`, and `moderatedBy`. A platform Review update records general
  `lastEdited*` metadata, and withdrawal records state, source, internal reason, time, and actor. These audit fields
  are not part of public output and do not establish author verification or the operator's purpose.
- Response and appeal deletion through normal collection access is disabled. Review deletion remains the separate
  platform-only soft-delete path and is not used for author withdrawal.

## Endpoint Boundary

The process uses these purpose-specific Review endpoints in addition to standard access-controlled Payload collection
reads and workflow writes:

| Endpoint | Process role |
| --- | --- |
| `POST /api/reviews/:id/moderation` | Platform-only public measure command. |
| `POST /api/reviews/:id/withdraw` | Owning-patient or platform-documented author withdrawal command. |
| `POST /api/reviews/:id/withdrawal-correction` | Platform-only correction of an erroneous withdrawal state. |
| `GET /api/reviews/:id/publication-history` | Private, no-store history for platform staff or the currently assigned clinic, with tenant and current-safety filtering. |

Request shapes, response DTOs, pagination, error codes, standard collection-read projections, and the Clinic Dashboard
BFF boundary are defined once in the
[Clinic Dashboard API contract](./integrations/clinic-dashboard-api.md#review-publication-response-and-appeal-upstream-contract).
