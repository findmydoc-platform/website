# findmydoc

findmydoc connects patients with clinics and their treatment offerings. This glossary defines the shared product language for clinic participation, patient inquiries, and reviews.

## Language

### People and access

**Clinic staff**:
A person authorized to work for an assigned clinic in the Clinic Dashboard. Staff access is distinct from a doctor's public professional profile.
_Avoid_: Doctor, public team member.

**Platform staff**:
A findmydoc operator acting within platform-level permissions for content, approvals, or moderation. Platform staff are distinct from clinic staff and patients.
_Avoid_: Unqualified admin, clinic staff.

**Patient email verification**:
Confirmation of the email address used to finish creating a findmydoc patient account. It does not establish medical identity or approve an Inquiry.
_Avoid_: Patient identity verification, inquiry approval.

### Clinics

**Clinic application**:
A clinic's request to join findmydoc, including its proposed initial contact. Application approval authorizes participation and the initial staff member; public publication is a separate decision.
_Avoid_: Published clinic, patient inquiry.

**Clinic registration receipt**:
An acknowledgement that findmydoc received a clinic's registration information. Receipt does not establish participation approval or public publication.
_Avoid_: Approval confirmation, activation email.

**Clinic staff invitation**:
An invitation to establish staff access to the Clinic Dashboard by choosing a password. It is distinct from receipt or approval of a clinic application.
_Avoid_: Clinic approval, registration receipt.

**Clinic participation**:
A clinic's authorized participation in the private Clinic Dashboard. Participation does not imply public publication.
_Avoid_: Public approval, clinic publication.

**Public clinic publication**:
A clinic's publication status for public discovery on findmydoc. It is independent of the clinic's private Dashboard participation.
_Avoid_: Dashboard approval, participation approval.

**Clinic profile draft**:
Unpublished proposed changes to a clinic's core profile content. The draft is separate from the published profile and excludes gallery images, doctor profiles, and treatment offerings.
_Avoid_: Published profile, gallery upload draft, unsaved editor state.

**Clinic profile gallery**:
The ordered image selection for a clinic profile, with the first image used as its main image. Private upload drafts and before-and-after treatment stories are separate.
_Avoid_: Gallery upload draft, before-and-after story.

**Public profile completion**:
The completeness of a clinic's published profile content, including its gallery and active treatment offerings. It is distinct from draft readiness, publication approval, and medical quality.
_Avoid_: Draft completeness, medical quality score, unqualified profile completeness.

**Saved clinic**:
A clinic a patient has saved for later reference. Saving a clinic does not create an inquiry or imply a recommendation.
_Avoid_: Recommended clinic, contacted clinic.

### Treatments

**Treatment**:
A centrally defined type of medical care shared across clinics. It is distinct from a clinic's offer of that treatment.
_Avoid_: Clinic treatment offering.

**Clinic treatment offering**:
A clinic-specific offer of a Treatment with its own price and active status.
_Avoid_: Treatment definition, booked treatment.

**Medical specialty**:
A field of medicine used to organize doctors and Treatments. It is distinct from a treatment or a clinic's treatment offering.
_Avoid_: Treatment, clinic treatment offering.

### Inquiries

**Inquiry**:
A request from a prospective patient to a clinic about care or treatment. An inquiry is not an appointment or treatment booking.
_Avoid_: Booking, appointment.

**Inquiry conversation**:
The private patient-clinic exchange associated with one Inquiry. A guest inquiry can exist without a conversation.
_Avoid_: Inquiry, internal note thread.

**Inquiry message**:
A message from the patient or clinic within an Inquiry conversation, visible to its participants subject to restrictions. Sent messages are immutable and distinct from clinic-only internal notes.
_Avoid_: Internal note, email notification.

**Inquiry internal note**:
An immutable clinic-only note attached to an Inquiry. It is separate from the patient-facing conversation.
_Avoid_: Patient message, reply, medical record.

**Inquiry handling status**:
The clinic's handling classification for an Inquiry: submitted, in review, contacted, or spam. It is independent of whether the inquiry is open or closed and does not establish a booking.
_Avoid_: Inquiry lifecycle, booking status.

**Inquiry lifecycle**:
Whether an Inquiry is open or closed for external communication. Closing an inquiry preserves its handling classification and history.
_Avoid_: Handling status, deleted inquiry, completed treatment.

**Inquiry read position**:
A participant's personal reading state within an Inquiry. One staff member's reading state does not establish that the whole clinic has read or handled it.
_Avoid_: Clinic-wide read status, handling status, notification acknowledgement.

**Inquiry moderation report**:
A participant's report about the other party's message, attachment, or conversation. A report opens a moderation case without automatically restricting content or messaging.
_Avoid_: Restriction, spam classification, analytics report.

**Inquiry moderation appeal**:
A participant's objection to a moderation measure affecting them. Upholding the measure leaves it in place; overturning it restores the restricted content or communication.
_Avoid_: Review appeal, initial report.

**Conversation message notification**:
A neutral email notice announcing a new clinic message and directing the patient to the protected Inquiry conversation. It does not contain the conversation content.
_Avoid_: Inquiry message, conversation transcript, Dashboard notification record.

### Reviews

**Review response**:
A clinic's moderated reply to a patient review. A pending response or revision is separate from the reply approved for public display.
_Avoid_: Inquiry message, review appeal.

**Review appeal**:
A clinic's formal challenge to a patient review. An upheld appeal grants the clinic's challenge, while any change to public presentation remains a separate moderation decision.
_Avoid_: Inquiry moderation appeal, automatic review removal.

**Review public measure**:
The platform's decision about how a review appears publicly, such as added context, redacted text, a neutral placeholder, or removal. It is separate from review approval, author withdrawal, and appeal outcome.
_Avoid_: Approval status, appeal decision, author correction.

**Review author withdrawal**:
The author's withdrawal of a review from public display. It removes the public text, rating contribution, and clinic response without deleting the stored review or its history.
_Avoid_: Review deletion, public moderation, appeal outcome.
