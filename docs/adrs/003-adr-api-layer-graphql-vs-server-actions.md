# ADR: Use GraphQL API and Route-based Architecture instead of Server Actions

## Status

| Name    | Content           |
| ------- | ----------------- |
| Author  | Sebastian Schütze |
| Version | 1.0               |
| Date    | 26.03.2025        |
| Status  | approved          |

## Background

The project uses Payload CMS and GraphQL to manage and serve dynamic content for a healthcare comparison platform. The frontend is built with Next.js (App Router) and integrates with a headless CMS and authentication via Supabase. Consistent architecture and clear separation between frontend and backend are essential to keep the project scalable and maintainable.

## Problem Description

Next.js App Router supports multiple patterns for server-side logic: Server Actions and route-based APIs. Server Actions offer tight integration with UI components, while API routes (e.g. `route.ts`) offer a traditional backend-like layer. Mixing both approaches could lead to confusion and architectural inconsistency. We need to choose one consistent way to handle server-side logic across the application.

## Considerations

### Option 1: Use Server Actions

- **Pros:**
  - Seamless integration in React components
  - Less boilerplate for UI-driven forms and mutations

- **Cons:**
  - Tightly coupled to the UI layer (not reusable from mobile clients or background jobs)
  - Adds abstraction on top of Payload CMS's existing API layer (GraphQL), making the flow harder to follow
  - Not a natural fit when already using GraphQL and Payload routes

### Option 2: Use GraphQL and `route.ts` API (Chosen)

- **Pros:**
  - Clean separation of concerns between frontend and backend
  - Matches existing usage of GraphQL and Payload CMS
  - Easier to test, extend, and expose to non-UI clients (e.g., mobile, CLI)
  - Keeps server-side logic in one place (routes), reducing cognitive overhead

- **Cons:**
  - Slightly more boilerplate for simple UI interactions
  - Manual handling of input validation and mutation logic

## Decision with Rationale

We will use **GraphQL and route-based APIs** to handle all server-side logic. This aligns with our existing use of Payload CMS and its GraphQL interface. It also avoids coupling backend logic to React components and keeps the backend architecture clean and reusable. Server Actions are not used in this project to avoid architectural fragmentation.

## Technical Debt

- Slightly more complexity when handling small UI interactions (e.g. login or form submissions) via routes instead of actions
- Requires manual typing and validation of GraphQL payloads in routes

## Risks

- Developers familiar with Server Actions may try to mix patterns. To mitigate this, we will document and enforce the API-first pattern using GraphQL and routes only.

## Superseded by (Optional)

N/A
