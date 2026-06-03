## Implementation Plan: Ghost ID Cleanup in `MenuRebuildService`

### Checklist

**`src/domain/services/MenuRebuildService.ts`**
- [ ] Fix Bug 1: replace line 308 `groupDisplayOrder: existingData.groupDisplayOrder ?? []` with filtered version using `id in materializedGroups`
- [ ] Fix Bug 2: insert `productDisplayOrder` filter after line 160 (after both direct and mirror-category assignment paths), inside `materializeGroups`

**`src/domain/services/__tests__/MenuRebuildService.test.ts`**
- [ ] Extend "skips deleted groups": add `expect(transactionSets[0].data.groupDisplayOrder).toEqual([])` after the existing `groups` assertion
- [ ] New test: "removes soft-deleted product from productDisplayOrder"
- [ ] New test: "removes hard-deleted (absent) product from productDisplayOrder"

**Verification**
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes

### Fix 1 (line 308 in `attemptRebuild`)
```typescript
// BEFORE
groupDisplayOrder: existingData.groupDisplayOrder ?? [],

// AFTER
groupDisplayOrder: (existingData.groupDisplayOrder ?? []).filter(
  (id: string) => id in materializedGroups
),
```

### Fix 2 (insert after line 160 in `materializeGroups`, after both assignment paths)
```typescript
productDisplayOrder = productDisplayOrder.filter((pid) => {
  const product = productMap.get(pid);
  return product !== undefined && !product.data.isDeleted;
});
```
Line 259 (`const displayOrder = validProductIds(...)`) in `attemptRebuild` must NOT be changed — it collects IDs for batchGetDocs.

### New Tests (in `describe('edge cases')`)
- Extend "skips deleted groups": add `expect(transactionSets[0].data.groupDisplayOrder).toEqual([])`
- Soft-deleted product test: group with `productDisplayOrder: ['liveProduct', 'deletedProduct']`, deletedProduct has `isDeleted: true` → assert only `liveProduct` in rebuilt group's productDisplayOrder
- Hard-deleted product test: same but absentProduct not registered in mock → assert only presentProduct in rebuilt group's productDisplayOrder
