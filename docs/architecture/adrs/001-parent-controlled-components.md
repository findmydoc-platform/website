# ADR-001: Prefer Parent-Controlled Components Over Uncontrolled Components

## Status
Accepted

## Context
In React applications, form controls and interactive components can be implemented in two ways:

1. **Controlled Components (Parent-Controlled)**: The component's state is managed by the parent component through props (`value` and `onChange`/`onValueChange`). The component itself does not maintain internal state for the controlled values.

2. **Uncontrolled Components**: The component manages its own internal state, potentially accepting an initial value (`defaultValue`) but not being synchronized with parent state thereafter.

The findmydoc frontend codebase includes reusable UI components like `CheckboxGroup` that could theoretically support either pattern. We need to decide which pattern to standardize on to ensure consistency, maintainability, and alignment with our application architecture.

### Application Context
- We are building an **application**, not a component library for external consumption.
- Our components are used primarily within our own codebase with specific use cases (e.g., clinic filters, form controls).
- We use Next.js App Router with a mix of Server Components and Client Components.
- Data flow follows the "Smart Shells & Dumb UI" pattern where parent containers manage state and data fetching.
- We prioritize testability, especially through Storybook and Vitest.

## Decision
**We will prefer parent-controlled (controlled) components as the default pattern for all interactive UI components.**

Specifically:
- Components should expect `value` and `onValueChange` (or similar) props from their parent.
- Components should **not** maintain internal state for the primary control value(s).
- If a component needs to support both patterns temporarily during migration, it must clearly document the deprecation path and prefer the controlled API in all examples and documentation.
- The `defaultValue` pattern should only be used for truly uncontrolled HTML inputs or as a migration path that will be removed.

## Rationale

### Why Parent-Controlled?

1. **Single Source of Truth**: State lives in one place (the parent), eliminating synchronization issues and making data flow explicit and traceable.

2. **Predictable Behavior**: The component's rendered state is always derived from props, making it easier to reason about and debug.

3. **Better Testing**: Parent-controlled components are stateless presentational components that can be tested purely through prop manipulation, without needing to simulate complex internal state transitions.

4. **Storybook Alignment**: Our Storybook stories control components through `args`, which maps naturally to controlled components. Uncontrolled components require additional workarounds in stories.

5. **Form Integration**: Controlled components integrate seamlessly with form libraries, validation logic, and URL/query parameter synchronization (common in filter UIs).

6. **Application-Specific**: Since we're not building a library, we don't need to optimize for "ease of use in unknown contexts." We control all usage sites and can easily manage state in parent components.

7. **Smart Shells Pattern**: Aligns with our architectural principle that logic and state belong in "Smart Shell" containers (Pages, Layouts, Organisms), not in "Dumb UI" molecules.

### Considered Alternatives

#### Alternative 1: Uncontrolled Components
**Rejected** because:
- Creates "hidden state" that's harder to test and debug
- Requires refs or imperative APIs to read current values
- Doesn't align with our data flow patterns
- Makes features like "reset all filters" or "persist to URL" significantly more complex
- Breaks the principle of props-driven UI

#### Alternative 2: Support Both Patterns
**Rejected** because:
- Increases component complexity and maintenance burden
- Creates inconsistency in usage patterns across the codebase
- Requires conditional logic to detect controlled vs. uncontrolled mode
- Adds mental overhead for developers ("which pattern should I use here?")
- Not needed since we control all call sites

## Consequences

### Positive
- **Consistency**: All interactive components follow the same state management pattern.
- **Maintainability**: Simpler components with explicit data flow are easier to understand and modify.
- **Testability**: Storybook stories and unit tests become straightforward prop-based scenarios.
- **Flexibility**: Parent components have full control over state, enabling features like:
  - Persisting state to URL query parameters
  - Synchronizing multiple controls
  - Implementing complex validation logic
  - Adding undo/redo functionality
  
### Negative
- **Boilerplate**: Parent components must explicitly manage state with `useState` or similar hooks, even for simple cases.
- **Migration Effort**: Existing uncontrolled components need to be refactored or clearly documented as deprecated patterns.

### Neutral
- **Learning Curve**: Developers familiar with uncontrolled HTML inputs must learn the controlled pattern, but this is React best practice and well-documented.

## Implementation Notes

### For New Components
When creating a new interactive component:
```tsx
export interface MyComponentProps {
  value: string // or string[], boolean, etc.
  onValueChange: (value: string) => void
  // ...other props
}

export function MyComponent({ value, onValueChange }: MyComponentProps) {
  // No internal useState for the value
  // Render using `value` prop
  // Call `onValueChange` when user interacts
}
```

### For Existing Components
Components currently supporting both patterns (like `CheckboxGroup`) should:
1. Keep the controlled API as primary
2. Document the uncontrolled API as deprecated if present
3. Remove internal state management in a future cleanup pass
4. Update all call sites to use the controlled pattern

### Parent Component Pattern
```tsx
'use client'
function FilterPage() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  
  return (
    <CheckboxGroup
      label="Specialties"
      options={specialtyList}
      value={selectedOptions}
      onValueChange={setSelectedOptions}
    />
  )
}
```

## References
- React Documentation: [Controlled Components](https://react.dev/learn/sharing-state-between-components)
- `.github/instructions/frontend.instructions.md` - Component Architecture: Smart Shells & Dumb UI
- `docs/frontend/atomic-architecture.md` - Layer responsibilities
- Related Component: `src/components/molecules/CheckboxGroup/index.tsx`

## Review History
- **2025-12-14**: Decision accepted based on CheckboxGroup refactoring discussion and alignment with application architecture principles.
