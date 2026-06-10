# Implementation Plan — Issue #79: Mirror-group menus not rebuilt on category-membership changes

## Root cause (verified against source)

`MenuRebuildService.ts` treats a mirror MenuGroup (`mirrorCategoryId` set) inconsistently:

- **`materializeGroups()` (lines 144–186):** correctly uses the *category's* `productDisplayOrder` when `mirrorCategoryId` is set (lines 154–160).
- **`resolveMenuIds()` (lines 104–136):** decides which menus to rebuild by reading each group's *own* `productDisplayOrder` (line 122). It never consults the category, and `RebuildScope` (lines 6–11) has no `changedCategoryIds`, so a product added/removed from a mirrored *category* never selects the menu. **(Part A — selection gap.)**
- **`attemptRebuild()` prefetch (lines 255–272):** builds `allProductIds` from each group's own `productDisplayOrder` and fetches `mirrorCategoryIds` categories — but does **not** add the category's `productDisplayOrder` product IDs to `allProductIds`. So `materializeGroups()` iterating the category's order finds products missing from `productMap`, skips them (line 165), producing dangling `productDisplayOrder` entries with no `products` entry (crashes Remy ItemCard). **(Part B — prefetch gap.)**

Both must ship together: Part A makes category changes trigger rebuilds; without Part B those rebuilds re-run the dangler-producing materialization.

## Callers / scope wiring (verified)

`rebuildMenus`, `RebuildScope`, `resolveChangedProducts` have **no in-repo callers** — re-exported via `src/domain/services/index.ts` (lines 26–29), consumed cross-repo (businesses cascade / square-gateway). Cross-repo population of `changedCategoryIds` is out of scope here; this repo (a) adds the field, (b) makes `resolveMenuIds()` honor it, (c) makes materialization correct, (d) exports `resolveChangedCategories()` for the cross-repo caller to wire.

---

## Part A — Selection fix

### A1. Extend `RebuildScope` (lines 6–11)
Add `changedCategoryIds?: string[];`.

### A2. Make `resolveMenuIds()` mirror-aware (lines 88–142)
1. **Resolve mirror groups' product lists from the category, not the group.** After batch-reading group docs, when `g.data.mirrorCategoryId` is set, read the group's effective product list from the mirror category's `productDisplayOrder`. Batch-read referenced categories → `categoryProductMap` (skip `isDeleted`). For each group: `groupProductMap.set(g.id, g.data.mirrorCategoryId ? (categoryProductMap.get(g.data.mirrorCategoryId) ?? []) : validProductIds(g.data.productDisplayOrder))`.
2. **Select menus whose mirror group's `mirrorCategoryId` is in `changedCategoryIds`.** Build `groupMirrorCatMap` (groupId → mirrorCategoryId). For each menu, if any group's `mirrorCategoryId ∈ changedCategorySet`, `result.add(menu.id)`.
3. Hoist the shared "read referenced menu-group docs + menuId→groupIds map + groupId→mirrorCategoryId map + categoryProductMap" so both branches share one batch read.

### A3. Add `resolveChangedCategories()` (sibling of `resolveChangedProducts`, lines 363–407)
```
export async function resolveChangedCategories(businessId: string, syncTraceId: string): Promise<string[]>
```
Query `categoriesCollection().where('syncTraceId','==',syncTraceId).select().get()`, return `snap.docs.map(d => d.id)`. No walk-up — category membership changes are stamped directly. Export from `src/domain/services/index.ts`.

---

## Part B — Materialization prefetch fix (`attemptRebuild`, lines 235–322)

Reorder so categories are fetched **before** products; expand `allProductIds` with each non-deleted category's `validProductIds(productDisplayOrder)` before fetching products. `Promise.all([products, categories])` becomes sequential (categories → expand → products). Result: `productMap` is a superset of every product ID `materializeGroups()` iterates → no danglers. Add a code comment referencing #79.

---

## Tests (`src/domain/services/__tests__/MenuRebuildService.test.ts`)

Follow existing harness (`rebuildFixture.ts`, `mockFirestore`, assert on `transactionSets`). Mirror group `lWWo8L7WmEiEJuZgf3dM` → category `dKlTguVV2yNCVFJjH2sH` (9 products `mirP1..mirP9`) in menu `CcUqgkBxEnk1qYaNZ3K2`. Tests needing divergence register overrides where the group snapshot is stale.

**`Part A — changedCategoryIds`:**
- rebuilds mirror menu when its `mirrorCategoryId` in `changedCategoryIds`
- does not rebuild menus without a group mirroring the changed category
- no-op on empty `changedCategoryIds`
- no-op on unknown `changedCategoryIds`
- unions `changedCategoryIds` with `changedProductIds` (2 menus)
- selects mirror menu when a `changedProductId` lives only in the mirror category, not the stale group snapshot

**`Part B — mirror prefetch superset (no danglers)`:**
- materializes category products absent from the stale group snapshot (written `productDisplayOrder` == 9-item category order; every entry has a `products[pid]`)
- product added to mirrored category is materialized
- product removed from mirrored category is dropped
- every `productDisplayOrder` entry has a `products` entry (invariant)

**`resolveChangedCategories`:**
- returns categories matching the syncTraceId
- returns empty when none match

Regression: TC1–TC11, changedMenuGroupIds, edge-case, TOCTOU suites still pass.

---

## Manual verification (business `oD2Q7WkxOXBgZPM5wxMN`, "Grab and Go")

1. Identify "Grab and Go" mirror MenuGroup(s), their `mirrorCategoryId`, and referencing menus.
2. Add a product to the mirror *category*'s `productDisplayOrder`, stamp `syncTraceId`.
3. Invoke rebuild with `changedCategoryIds` from `resolveChangedCategories(businessId, syncTraceId)` (or `rebuildMenus(businessId, { changedCategoryIds: [categoryId] })`).
4. Read materialized menu doc: group's `productDisplayOrder` matches category order; every ID has a `products` entry (no danglers).
5. Remove a product from the category, re-run; confirm it disappears from both.
6. Confirm Remy "Grab and Go" renders without ItemCard crashes.

---

## Implementation Groups

All groups edit the same `MenuRebuildService.ts` (+ index.ts, + test file), so they **serialize** — implement sequentially in one pass, not parallel subagents.

### Checklist

**Group 1 — Interface & selection (Part A core)**
- [ ] Add `changedCategoryIds?: string[]` to `RebuildScope` (lines 6–11).
- [ ] Hoist "read referenced menu-group docs + menuId→groupIds map" to run once when `changedProductIds` **or** `changedCategoryIds` present.
- [ ] Batch-read mirror categories referenced by those groups; build `categoryProductMap` (skip deleted).
- [ ] Build `groupProductMap` from the category's `productDisplayOrder` when group has `mirrorCategoryId`, else the group's own.
- [ ] Build `groupMirrorCatMap` and add branch selecting menus whose group's `mirrorCategoryId ∈ changedCategoryIds`.
- [ ] Confirm union semantics with `menuIds`, `changedProductIds`, `changedCollectionIds`, `changedMenuGroupIds` preserved.

**Group 2 — Changed-category resolver & export (Part A wiring)**
- [ ] Add exported `resolveChangedCategories(businessId, syncTraceId)`.
- [ ] Add to barrel export in `src/domain/services/index.ts`.

**Group 3 — Prefetch superset (Part B)**
- [ ] In `attemptRebuild()`, fetch mirror categories **before** products (reorder the `Promise.all`).
- [ ] Add each non-deleted category's `validProductIds(productDisplayOrder)` to `allProductIds` before fetching products.
- [ ] Code comment referencing #79 explaining categories-before-products ordering.
- [ ] Verify `materializeGroups()` now guaranteed a `productMap` superset.

**Group 4 — Tests** (depends on 1–3)
- [ ] `Part A — changedCategoryIds` block (6 cases).
- [ ] `Part B — mirror prefetch superset` block (4 cases).
- [ ] `resolveChangedCategories` block (2 cases).
- [ ] Confirm existing suites still pass.

**Group 5 — Version & verification** (depends on 1–4)
- [ ] `npm run tsc` clean; `npx eslint src/` clean.
- [ ] `npm test` green.
- [ ] Bump `package.json` version (minor — new exported feature).
- [ ] Manual verification against `oD2Q7WkxOXBgZPM5wxMN` "Grab and Go".
