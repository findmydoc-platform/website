# 008. Styling Architecture: CVA over @apply

**Status:** Accepted
**Date:** 2025-11-24
**Context:**
We use Tailwind CSS v4 and shadcn/ui. A common anti-pattern is extracting long Tailwind strings into Global CSS using `@apply` or semantic classes (e.g., `.btn-primary`) to "clean up" JSX. This conflicts with shadcn/ui's architecture, which uses `class-variance-authority` (CVA) to manage variants directly in TypeScript.

**Decision:**
1.  **Enforce CVA:** We will strictly use **CVA** for defining component variants and states.
2.  **Forbid Component `@apply`:** We explicitly forbid using `@apply` in global CSS to create component classes. Styles must remain colocated with the component code.
3.  **Limit Custom Utilities:** We will only use the CSS `@utility` directive for small, atomic shortcuts (e.g., `flex-center`) that are generic and not tied to specific business components.

**Consequences:**
* **Positive:** Full type safety for component props (e.g., `<Button variant="ghost" />`), better maintainability via colocation, and consistency with the shadcn/ui ecosystem.
* **Negative:** Component files may appear more verbose due to inline class strings.
