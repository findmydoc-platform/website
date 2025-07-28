# Review Modification Process

## Overview

Once patients submit reviews, they cannot edit them directly. All review modifications must go through Platform Staff to maintain review integrity and prevent abuse.

## Process Flow

```mermaid
flowchart TD
    A[Patient submits review] --> B[Review status: 'pending']
    B --> C[Platform Staff moderates]
    C --> D{Review approved?}
    D -->|Yes| E[Status: 'approved'<br/>Review published]
    D -->|No| F[Status: 'rejected'<br/>Review not published]
    
    E --> G[Patient wants to modify review]
    G --> H[Patient contacts Platform Support]
    H --> I[Platform Staff evaluates request]
    I --> J{Valid modification request?}
    
    J -->|Yes| K[Platform Staff makes approved changes]
    J -->|No| L[Request denied with explanation]
    
    K --> M[Changes logged in audit trail]
    M --> N[Patient notified of changes]

    style A fill:#e1f5fe
    style E fill:#c8e6c9
    style F fill:#ffcdd2
    style K fill:#fff3e0
    style L fill:#ffcdd2
```

## Rules

1. **No Patient Editing**: Once submitted, patients cannot edit reviews directly
2. **Platform Staff Only**: Only Platform Staff can modify reviews
3. **Support Process**: Patients contact support for legitimate correction requests
4. **Audit Trail**: All changes are logged with timestamps and staff member ID

## Valid Modification Requests

- Factual errors (wrong treatment date, procedure name)
- Typos or grammatical mistakes
- Privacy concerns (removing personal information)
- Updated medical outcomes

## Invalid Modification Requests

- Rating changes without factual basis
- Retaliation against clinic/doctor
- Changes under pressure from healthcare providers
- Emotional changes without valid reason

## Technical Implementation

- **Update Access**: Platform Staff only
- **Audit Fields**: `lastEditedAt`, `editedBy`
- **Logging**: All modifications logged for compliance
- **Status Control**: Only Platform Staff can approve/reject reviews
