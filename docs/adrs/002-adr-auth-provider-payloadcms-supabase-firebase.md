# ADR: Authentication Provider for Payload CMS

## Status

| Name    | Content           |
| ------- | ----------------- |
| Author  | Sebastian Schütze |
| Version | 1.0               |
| Date    | 28.02.2025        |
| Status  | approved          |

## Background

The project requires a robust and secure authentication provider to manage user identities for a healthcare comparison platform built on Payload CMS, where security is critical due to the sensitivity of healthcare-related data. The authentication system must support multiple authentication methods, enforce strong security measures, and integrate seamlessly with existing infrastructure.

## Problem Description

The project needs a reliable authentication solution that ensures security, scalability, and maintainability. There are three main options:

1. **Use Payload CMS's built-in authentication**
2. **Use Firebase Authentication**
3. **Use Supabase Authentication**

Each solution has different security models, scalability capabilities, and integration challenges, which directly impact maintainability, long-term flexibility, and potential vendor lock-in. Evaluating these factors ensures that the selected authentication provider aligns with the project's needs for data consistency, security compliance, and future scalability.

## Considerations

### **Payload CMS Built-in Authentication**

**Pros:**

- Direct integration into Payload CMS
- No external dependency required
- Simple setup for user authentication

**Cons:**

- Security is not the core focus of Payload CMS
- No built-in MFA (Multi-Factor Authentication)
- No strong vendor-backed security and compliance certifications (SOC 2, ISO 27001)
- Not optimized for large-scale applications

### **Firebase Authentication**

**Pros:**

- Google-backed authentication solution with high security
- Supports OAuth, SSO, MFA, and multiple authentication providers
- Well-tested and widely used in production

**Cons:**

- Proprietary authentication system, creating a vendor lock-in
- User data is stored in Firebase's proprietary NoSQL databases (Realtime Database or Firestore), making integration with PostgreSQL-based systems more complex
- No direct SQL access for user queries

### **Supabase Authentication (Chosen Solution)**

**Pros:**

- Built on PostgreSQL, allowing seamless integration with our existing database by storing authentication data in a dedicated schema within the same PostgreSQL instance.
- Supports OAuth, email/password authentication, and third-party authentication providers
- Built-in Row Level Security (RLS) for fine-grained access control at the database level
- No vendor lock-in; fully open-source and self-hostable if needed
- Ensures data consistency by managing authentication and user data within PostgreSQL
- Stronger compliance and security model than Payload CMS's native authentication

**Cons:**

- Requires additional setup compared to Firebase
- SaaS dependency (unless self-hosted)

## Decision with Rationale

Supabase Authentication is chosen as the authentication provider for Payload CMS, aligning with the project's long-term goals of maintaining security, scalability, and flexibility while avoiding vendor lock-in and ensuring seamless database integration. The decision is based on:

- **Security:** Supabase enforces Row Level Security at the database level, ensuring fine-grained access control.
- **Scalability:** It supports authentication for a large user base without proprietary database constraints.
- **Maintainability:** It integrates directly with PostgreSQL, eliminating the need for separate authentication database management.
- **Flexibility:** It provides various authentication methods (OAuth, email/password, etc.) while remaining open-source.
- **Avoiding Vendor Lock-in:** Unlike Firebase, Supabase allows full control over user data and database queries.

## Technical Debt

- **Supabase SaaS Dependency:** While Supabase is open-source and self-hostable, using the SaaS model introduces reliance on an external service.
- **Potential Maintenance Overhead:** Row Level Security (RLS) and permissions management must be carefully configured to avoid misconfigurations.

## Risks

- **Supabase Service Downtime:** If Supabase SaaS experiences downtime, authentication may be affected. Mitigation: Monitor uptime and consider a self-hosted fallback if necessary.
- **Security Configurations:** Improperly configured RLS policies could expose sensitive data. Mitigation: Implement strict access control and review security policies regularly.

## Deprecated (Optional)

N/A

## Superseded by (Optional)

N/A