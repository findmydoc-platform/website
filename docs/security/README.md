# Website security documentation

Supabase supplies identity and user sessions. Payload resolves the current application principal and enforces
business authorization.

- [Authentication system](./authentication-system.md) explains the principal model, session boundaries, and lifecycle.
  [Authentication flow diagram](./auth-flow-diagram.md) traces sign-in and provisioning.
- [Provisioning](./supabase-provisioning.md) describes identity creation, linkage, and cleanup. [Auth actions](./auth-actions.md)
  covers the private lifecycle for verification, invitation, and password recovery.
- [Collection permissions](./permission-matrix.md) explains how to read and maintain the
  [generated permission table](./permission-matrix.generated.md).
- [Clinic participation](./clinic-participation.md), [clinic groups](./clinic-groups.md), and
  [clinic staff assignments](./clinic-staff-assignments.md) define current Dashboard access.
- [Supabase native-mail suppression](./supabase-native-mail-suppression.md) describes the hosted mail boundary.
- [Security-related dependency overrides](./overrides.md) records why specific transitive dependencies are pinned.
