# Supabase Authentication Flows by Application Surface

## Clinic Dashboard

```mermaid
sequenceDiagram
    actor User
    participant Browser as Dashboard Browser
    participant BFF as Dashboard BFF
    participant Supabase as Supabase Auth
    participant Payload as Payload API and Auth Strategy
    participant DB as Payload Database

    User->>Browser: Sign in
    Browser->>BFF: Start login on same origin
    BFF->>Supabase: Start PKCE flow
    Supabase-->>Browser: Identity provider redirect
    Browser->>BFF: Callback with authorization code
    BFF->>Supabase: Exchange code and establish session
    BFF-->>Browser: Secure HttpOnly session cookies
    Browser->>BFF: Request Dashboard data
    BFF->>Payload: Bearer access token
    Payload->>Payload: Validate token and select clinicStaff
    Payload->>DB: Read current status, clinic, and permissions
    alt Approved and assigned
        DB-->>Payload: Current clinic principal
        Payload-->>BFF: Purpose-specific DTO
        BFF-->>Browser: Private no-store response
    else Missing, conflicting, ineligible, or forbidden
        Payload-->>BFF: 401 or 403 without clinic data
        BFF-->>Browser: Controlled login or access state
    end
```

The Dashboard browser calls only the Dashboard origin for application data. Tokens remain in host-bound `HttpOnly`
cookies and server code. Payload receives server-to-server requests from the BFF, so Dashboard origins are not Payload
CORS origins.

## Payload Admin

```mermaid
sequenceDiagram
    actor Staff as Platform Staff
    participant Admin as Payload Admin Surface
    participant Supabase as Supabase Auth
    participant Payload as Payload Auth Strategy
    participant DB as Payload Database

    Staff->>Admin: Submit platform login
    Admin->>Supabase: Authenticate platform identity
    Admin->>Payload: Present authenticated identity
    Payload->>DB: Resolve platformStaff and current role
    alt Eligible platform principal
        DB-->>Payload: Current role
        Payload-->>Admin: Allow Admin capabilities
    else Missing or forbidden principal
        Payload-->>Admin: Deny Admin access
    end
```

Only `platformStaff` can enter Payload Admin. Clinic staff and patients are explicitly denied.

## Patient Portal

```mermaid
sequenceDiagram
    actor Patient
    participant Portal as Website Portal
    participant Supabase as Supabase Auth
    participant Payload as Website Payload Boundary
    participant DB as Payload Database

    Patient->>Portal: Start patient authentication
    Portal->>Supabase: Authenticate or complete callback
    Portal->>Payload: Make an authenticated website request
    Payload->>DB: Ensure or resolve patients principal
    DB-->>Payload: Current patient principal
    Payload-->>Portal: Patient-scoped result
```

The Dashboard decision does not change the patient portal session or ensure-on-auth behavior.

## Shared Authorization Facts

The Supabase claim chooses a principal collection only. Payload reads the current platform role, clinic relation, and
clinic approval status from the resolved principal for every request. Staff principals are provisioned before login;
patients retain ensure-on-auth. Missing, duplicate, or conflicting principals fail closed.
