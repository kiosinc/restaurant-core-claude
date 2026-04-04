# Issue #48: extractAssetIdsByType should use map key, not asset.assetId

## Problem

`extractAssetIdsByType` in `MenuRebuildService.ts` uses `Object.values()` and relies on `asset.assetId` to find group/collection IDs. The `menuAssets` map is keyed by asset ID, so `assetId` on the value is redundant. When a client writes a `menuAssets` entry without the redundant `assetId` property, `extractAssetIdsByType` silently skips it, causing the group to be dropped from the rebuilt menu doc.

## Implementation Steps

### Step 1: Fix `extractAssetIdsByType` in `MenuRebuildService.ts`

**File:** `src/domain/services/MenuRebuildService.ts` (lines 37-44)

Change from `Object.values()` + `asset.assetId` to `Object.entries()` + map key:

```ts
function extractAssetIdsByType(
  menuAssets: Record<string, MenuAsset>,
  type: MenuAsset['assetType'],
): string[] {
  return Object.entries(menuAssets)
    .filter(([, asset]) => asset.assetType === type)
    .map(([id]) => id);
}
```

### Step 2: Remove `assetId` from `MenuAsset` interface

**File:** `src/domain/surfaces/Menu.ts` (line 26)

Remove the `assetId` field from the `MenuAsset` interface:

```ts
export interface MenuAsset {
  assetType: 'product' | 'group' | 'collection' | 'htmlText';
  configuration?: any;
}
```

### Step 3: Update test fixtures

**File:** `src/domain/services/__tests__/rebuildFixture.ts`

Update all 4 menu fixtures so the `menuAssets` keys are the actual group/collection IDs (not arbitrary `a1`, `a2` keys). Remove `assetId` from all fixture values. Also update `menuAssetDisplayOrder` arrays to use the real IDs.

Example for Main Menu (CcUqgkBxEnk1qYaNZ3K2):
```ts
menuAssets: {
  '0YRxtglWpkDyxcW8WCTD': { assetType: 'group' },
  lWWo8L7WmEiEJuZgf3dM: { assetType: 'group' },
  mg4: { assetType: 'group' },
  mg5: { assetType: 'group' },
  I6XLVNjKrBAcBEmqQV0q: { assetType: 'collection' },
  col2: { assetType: 'collection' },
},
menuAssetDisplayOrder: ['0YRxtglWpkDyxcW8WCTD', 'I6XLVNjKrBAcBEmqQV0q', 'lWWo8L7WmEiEJuZgf3dM', 'mg4', 'mg5', 'col2'],
```

Apply the same pattern to all 4 menus.

### Step 4: Update existing test for edge case (skips deleted groups)

**File:** `src/domain/services/__tests__/MenuRebuildService.test.ts` (line 356)

Update the inline fixture in the "skips deleted groups" test to use the key as the ID:
```ts
menuAssets: { g1: { assetType: 'group' } },
```

### Step 5: Add new unit tests for `extractAssetIdsByType`

**File:** `src/domain/services/__tests__/MenuRebuildService.test.ts`

Add a new `describe` block for `extractAssetIdsByType`. Since the function is not exported, test it indirectly through `rebuildMenus` or export it for testing.

**Preferred approach:** Test indirectly by adding fixture data with entries that have no `assetId` field (which is now the only shape, since `assetId` is removed from the interface). The existing tests already validate correct behavior when all entries are present — just confirm they still pass after the change.

Add one explicit test:
- **TC: Entry without legacy assetId field is included in rebuild** — Register a menu with `menuAssets: { 'new-group': { assetType: 'group' } }` (no `assetId`), register the corresponding menu group, trigger rebuild, and assert the group appears in the output.

### Step 6: Compile and run tests

```bash
npm run tsc
npm test
```

## Test Criteria

1. `extractAssetIdsByType` returns IDs from map keys for entries without `assetId` field
2. Existing entries (now without `assetId`) still return the correct map key
3. `MenuAsset` interface no longer includes `assetId` — codebase compiles clean
4. All existing tests pass (TC1-TC4, TC10, TC11, edge cases, resolveChangedProducts)
5. New test validates that a menu group added without `assetId` persists after rebuild
6. `extractAssetIdsByType` uses `Object.entries()` consistent with `rebuildRouter.ts` pattern

## Version Bump

Bump `package.json` version from `1.5.3` to `1.5.4` (patch — bug fix).
