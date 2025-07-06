# PayloadCMS Hooks: Best Practices & Patterns

## When to Use Hooks

Hooks are PayloadCMS's way to extend collection behavior with custom business logic:

- **Data Validation**: Complex validation beyond basic field rules
- **Calculated Fields**: Auto-compute values like averages, totals, counts
- **Related Data Updates**: Update dependent records when data changes
- **External Integrations**: Sync with third-party services, send notifications
- **Audit Trails**: Log changes for compliance or debugging

## Hook Types & Timing

- **`beforeValidate`** - Transform data before validation
- **`afterChange`** - React to successful data changes (most common)
- **`afterDelete`** - Clean up related data after deletion
- **`beforeChange`** - Last chance modifications before save

## Critical: Transaction Context in Hooks

### The Problem
PayloadCMS v3 uses database transactions. Hooks run within the same transaction as the triggering operation, but **database queries in hooks can't see uncommitted data** unless you explicitly pass transaction context.

### Real Example: Price Calculation Hook
When a clinic treatment is created, we need to recalculate the treatment's average price:

```typescript
// ❌ BROKEN: Can't see the newly created clinic treatment
export const updateAveragePriceAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const clinicTreatments = await payload.find({
    collection: 'clinictreatments',
    where: { treatment: { equals: doc.treatment } }
    // Missing req! Query runs outside transaction
  })
  // Returns empty array, even though clinic treatment was just created
}

// ✅ WORKING: Sees all data within the transaction
export const updateAveragePriceAfterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const clinicTreatments = await payload.find({
    collection: 'clinictreatments',
    where: { treatment: { equals: doc.treatment } },
    req // Essential: Include transaction context
  })
  // Now sees the newly created clinic treatment!
}
```

### The Rule
**Always pass `req` to database operations in hooks** - otherwise you'll get stale data and confusing bugs.

## Common Patterns

### 1. Calculated Fields
```typescript
export const calculateTotals: CollectionAfterChangeHook = async ({ doc, req }) => {
  const total = await calculateSomething(req) // Pass req!

  await payload.update({
    collection: 'treatments',
    id: doc.id,
    data: { calculatedTotal: total },
    req // Transaction context
  })
}
```

### 2. Prevent Infinite Loops
```typescript
export const myHook: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.context.skipHooks) return doc // Prevent loops

  await payload.update({
    collection: 'other-collection',
    data: { updated: true },
    context: { skipHooks: true }, // Skip hooks on this update
    req
  })
}
```

### 3. Error Handling
```typescript
export const safeHook: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    // Your hook logic
  } catch (error) {
    req.payload.logger.error('Hook failed:', error)
    // Don't throw - would rollback the entire transaction
  }
  return doc
}
```

## Testing Hooks

Integration tests are essential for hooks since they involve database transactions:

```typescript
it('should calculate average price when clinic treatment is created', async () => {
  await payload.create({
    collection: 'clinictreatments',
    data: { price: 100, clinic: testClinic.id, treatment: testTreatment.id }
  })

  const treatment = await payload.findByID({
    collection: 'treatments',
    id: testTreatment.id
  })

  expect(treatment.averagePrice).toBe(100) // Hook worked!
})
```

## Key Takeaways

1. **Pass `req`** to all database operations in hooks
2. **Use `context.skipHooks`** to prevent infinite loops
3. **Handle errors gracefully** to avoid transaction rollbacks
4. **Test with integration tests** - unit tests can't verify transaction behavior
5. **Keep hooks focused** - one responsibility per hook

## Reference
[PayloadCMS Database Transactions](https://payloadcms.com/docs/database/transactions)

*Remember: Hooks are powerful but can be tricky. When in doubt, add logging and write tests!*