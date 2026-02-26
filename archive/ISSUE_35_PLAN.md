# Issue #35: Write Model Revamp: Menu Model Extensions, MenuRebuildService, AvailabilityService, FeatureFlagService

## Summary

Add Menu model type extensions, a `syncTraceId` field on BaseEntity, and three new services (MenuRebuildService, AvailabilityService, FeatureFlagService) to the shared library. This package publishes to Artifact Registry first — all 5 consuming services depend on it at build time.

## Context

The current 3-service cascade (square-gateway → cloud-functions-businesses triggers → ego) produces ~2,470 Firestore writes per full 200-product sync. This issue provides the shared infrastructure that the other 5 issues consume to replace that cascade with a normalized catalog + sync-time menu rebuild model, reducing writes to ~475.

## Architecture Overview

1. **Catalog entities are normalized** — each doc stores only its own data. No embedded `products` maps in Category/MenuGroup, no embedded `groups`/`collections` maps in Menu.
2. **Relationships stored as arrays** — `productDisplayOrder` on Category/MenuGroup, `menuAssets` on Menu. These already exist today.
3. **Menu rebuild produces a materialized doc** — `MenuRebuildService` reads normalized docs (MenuGroups → Products → Collections) and writes a single materialized Menu doc. Same Firestore path as today (`businesses/{bid}/public/surfaces/menus/{menuId}`), same doc shape.
4. **Rebuild is scoped** — callers pass `changedProductIds`, `changedCollectionIds`, or `menuIds` so the service only rebuilds affected menus. Falls back to full rebuild when no scope provided.
5. **Availability doc** provides per-location inventory — separate from the menu structure. New path: `businesses/{bid}/public/inventory/{locationId}`.

## Dependency

**Blocking**: Issues on square-gateway-claude, businesses, childs, cloud-functions-businesses, and ego all depend on this issue being published to Artifact Registry first.

## Implementation

### 1. Menu Model Extensions

The `Menu` interface is significantly behind the actual Firestore document shape. The following fields are written to Menu docs by businesses and childs but are not declared in TypeScript.

**New interfaces to add:**

1. `MenuCollectionMeta` — fields: `name`, `displayName`, `imageGsls: string[]`, `videoGsls: string[]`, `isUserInteractionEnabled: boolean`, `type: string`, `hyperlink: string`
2. `MenuAsset` — fields: `assetType: 'product' | 'group' | 'collection' | 'htmlText'`, `assetId: string`, `configuration?: any`
3. `MenuProductMeta` — fields: `isActive: boolean`, `name: string`, `imageGsls: string[]`, `minPrice: number`, `variationCount: number`, `description: string` (all 6 fields always present — ego's cascade writes all 6 to `Menu.groups.{gid}.products.{pid}`, the rebuild must match)

**Extend `Menu` interface with:**
- `collections?: { [id: string]: MenuCollectionMeta }`
- `menuAssets?: { [id: string]: MenuAsset }`
- `menuAssetDisplayOrder?: string[]`
- `version?: string`
- `products?: { [id: string]: MenuProductMeta }`

**Extend `MenuGroupMeta` with:**
- `imageGsls?: string[]`
- `productDisplayOrder?: string[]`
- `mirrorCategoryId?: string | null`
- `products?: { [id: string]: MenuProductMeta }`

All new fields are optional (backward-compatible with existing v2.0 menus).

**Update Firestore converter** to serialize/deserialize the new fields.

**File**: `src/domain/surfaces/Menu.ts` — MODIFY

### 2. BaseEntity — syncTraceId

`syncTraceId` currently exists only as a logging parameter threaded through function arguments. It is not a field on any Firestore document. Since `isStopSync()` is generic (`<T extends BaseEntity>`) and stamps `syncTraceId` on all entity types uniformly, the field must be added at the base level.

1. Add `syncTraceId?: string` to `BaseEntity` interface and `baseEntityDefaults()` factory
2. No converter changes needed — `toFirestore` uses `...fields` spread (all interface fields are serialized automatically), and `fromFirestore` spreads all Firestore data back
3. **Firestore indexes required** (deploy before square-gateway goes live): Single-field indexes on `syncTraceId` for each of: `products`, `optionSets`, `options`, `categories`, `taxRates`, `discounts` collections. Required for `WHERE syncTraceId == traceId` queries.

**File**: `src/domain/BaseEntity.ts` — MODIFY

### 3. FeatureFlagService

Reads `config/writeModelFlags` Firestore doc, caches in-memory with 60-second TTL. Single API: `getFlags(): Promise<WriteModelFlags>`.

```typescript
interface WriteModelFlags {
  enableMenuRebuild: boolean          // default: true — flip false to disable rebuild
  enableAvailabilityDoc: boolean      // default: true — flip false to skip availability doc writes
  writeLegacyOptionInventory: boolean // default: false — flip true to resume Option.locationInventory writes
}
```

Flags default to final-state behavior — they exist only for emergency rollback.

**File**: `src/domain/services/FeatureFlagService.ts` — NEW

### 4. MenuRebuildService

Scoped rebuild service with change tracking resolution.

**API:**

```typescript
rebuildMenus(businessId: string, scope?: {
  menuIds?: string[],
  changedProductIds?: string[],
  changedCollectionIds?: string[],
}): Promise<void>

resolveChangedProducts(businessId: string, syncTraceId: string): Promise<string[]>
```

**rebuildMenus — Scope resolution (union of all scope fields):**

- If `changedProductIds` provided:
  1. Read all Menus for business (typically 1-5 docs)
  2. Read their MenuGroups via `menuAssets` (batch read)
  3. Check `productDisplayOrder` arrays for containment
  4. Filter to affected menus only
- If `changedCollectionIds` provided:
  1. Read all Menus for business (reuse from above if already read)
  2. Check `menuAssets` for entries with `assetType: 'collection'` matching any changed ID
  3. Filter to affected menus only
- If `menuIds` provided: use directly — no resolution needed
- If no scope: rebuild all menus
- Final set = union of menus matched by all provided scope fields

**Per-menu rebuild (two phases):**

Phase A — Bulk reads (outside transaction):
1. Read `menuAssets` from Menu doc
2. Batch-read MenuGroups + Collections via `menuAssets`
3. For each MenuGroup: read `productDisplayOrder` → batch-read Products (OptionSets/Options NOT read — materialized doc contains lean ProductMeta only)
4. Skip any entity with `isDeleted: true` (soft-deleted during sync, pending cleanup)
5. Assemble materialized sections:
   - `groups.<groupId>`: `displayName`, `name`, `imageGsls[]` (always present, may be empty `[]`), `mirrorCategoryId`, `productDisplayOrder[]`
   - `groups.<groupId>.products.<productId>`: `isActive`, `name`, `imageGsls[]`, `minPrice`, `variationCount`, `description` (all 6 fields always present)
   - `collections.<collectionId>`: `displayName`, `name`, `imageGsls[]`, `videoGsls[]`, `isUserInteractionEnabled`, `type`, `hyperlink`
   - Plus `menuAssets`, `menuAssetDisplayOrder`, `version`

Phase B — Atomic write (inside transaction, 2 doc operations):
6. Read existing Menu doc inside transaction (preserves structural fields: `name`, `displayName`, `coverImageGsl`, `coverBackgroundImageGsl`, `coverVideoGsl`, `logoImageGsl`, `gratuityRates`, `managedBy`, `created`, `isDeleted`)
7. Merge materialized sections from Phase A onto existing Menu doc
8. Write merged Menu doc via `t.set()` (transaction commit)

Why two phases: Bulk reads (MenuGroups, Collections, Products) don't need transactional protection because normalized source docs are guarded by the sync semaphore. Only the Menu doc read+write needs atomicity. Read counts are modest (~31-181 docs per menu).

**Important — imageGsls field**: All groups in Menu docs have `imageGsls` as empty arrays (`[]`). The rebuild MUST write `imageGsls: []` on every group in the materialized Menu doc — omitting it would be a regression.

**resolveChangedProducts — Change tracking resolution:**

Called at sync completion to resolve the full set of affected products:
1. Query `products WHERE syncTraceId == traceId` (IDs only via `.select()`)
2. Query `optionSets WHERE syncTraceId == traceId` (IDs only)
3. Query `options WHERE syncTraceId == traceId` (IDs only)
4. If changedOptions non-empty: load ALL optionSets for the business (`.select('options')` — keys only), scan map keys in memory to find parents. Merge matched optionSet IDs into changedOptionSets.
5. If changedOptionSets has new entries from step 4: load ALL products for the business (`.select('optionSets')` — keys only), scan map keys to find parents. Merge into changedProducts.
6. Return deduplicated `changedProductIds` set

Cost: 3-5 queries total (3 syncTraceId + up to 2 collection scans). Bounded regardless of how many entities changed.

**File**: `src/domain/services/MenuRebuildService.ts` — NEW

### 5. AvailabilityService

Reads/writes per-location availability doc at `businesses/{bid}/public/inventory/{locationId}`.

Doc shape:
```typescript
{
  products: { [pid: string]: { isAvailable: boolean } },
  options: { [oid: string]: { isAvailable: boolean, count: number, state: string, timestamp: string } }
}
```

~20KB per location. Well under 1MB limit.

Write strategy: `set()` with `{ merge: true }` and dot-notation field paths for concurrent safety:
```typescript
await availabilityDocRef.set({
  [`options.${optionId}`]: { isAvailable, count, state, timestamp }
}, { merge: true })
```

Data sources:
- `options` section: from `inventory.count.updated` webhook (real-time)
- `products` section: from catalog sync presence flags (`presentAtAllLocations`/`absentAtLocationIds`) — sync-time only, no count

**File**: `src/domain/services/AvailabilityService.ts` — NEW

### 6. Old Handlers (Kept as Dead Code)

Keep `ProductRelationshipHandler`, `productSpec`, `menuMetadataSpec`, and `menuGroupMetadataSpec` as-is. Square-gateway stops registering them (square-gateway-claude issue), so they become unused exports. No removal needed — dead code is harmless and avoids breaking any other consumer that might import them.

## Files Changed

| File | Change |
|------|--------|
| `src/domain/surfaces/Menu.ts` | MODIFY — extend Menu interface; add MenuCollectionMeta, MenuAsset, MenuProductMeta; extend MenuGroupMeta |
| `src/domain/BaseEntity.ts` | MODIFY — add `syncTraceId?: string` to interface + `baseEntityDefaults()` |
| `src/domain/services/MenuRebuildService.ts` | NEW — scoped rebuild + change tracking resolution |
| `src/domain/services/AvailabilityService.ts` | NEW — per-location availability doc reads/writes |
| `src/domain/services/FeatureFlagService.ts` | NEW — config doc reader with TTL cache (3 kill-switch flags) |

## Test Cases

All rebuild tests use anchor business `SU5JWga8rcAomZBtpYY0` from dev environment as the test oracle. Fixture at `src/__tests__/fixtures/rebuildFixture.json` (432 KB) — 4 menus, 11 menuGroups, 9 collections, 39 products, 59 optionSets, 144 options, 7 categories.

**Known data quality issue**: Product `ozil5WuJ4qeSGhwcusPS` ("do not buy") has only 2 fields (`isActive`, `name`) in the current Menu doc instead of the expected 6. This product was likely added to a menu group manually, and ego only wrote partial metadata. The rebuild reads Product docs directly and will produce full 6-field metadata — this is a correctness improvement. Test assertions for full rebuild (TC1) expect 6 fields for ALL products.

**TC1 — Full rebuild exact match**

Feed all 11 MenuGroups, 39 Products, and 9 Collections into `rebuildMenus()` with no scope (full rebuild). Assert:
- Output contains all 4 materialized Menu docs
- Each Menu has structural fields preserved (`displayName`, `name`, `version`, `isDeleted`, `created`, cover images, gratuity rates)
- Each group in `Menu.groups` has fields: `displayName`, `name`, `imageGsls` (array, may be empty), `mirrorCategoryId`, `productDisplayOrder`
- Each product entry in `Menu.groups.{gid}.products.{pid}` has exactly 6 fields: `isActive`, `name`, `imageGsls`, `minPrice`, `variationCount`, `description`
- ALL 72 product entries have 6 fields (including `ozil5WuJ4qeSGhwcusPS` which currently has only 2 — the rebuild corrects this by reading Product docs directly)
- `minPrice` values match source Product docs (e.g., `ozil5WuJ4qeSGhwcusPS` should have `minPrice: 10`, not `undefined`)
- Each collection in `Menu.collections` has 7 fields: `displayName`, `name`, `imageGsls`, `videoGsls`, `isUserInteractionEnabled`, `type`, `hyperlink`
- All products in Menu docs trace back to existing source Product docs (no orphans)

**TC2 — Scoped rebuild: product in all menus**

Product `ozil5WuJ4qeSGhwcusPS` ("do not buy") appears in all 4 menus via group `0YRxtglWpkDyxcW8WCTD`. Call `rebuildMenus(bid, { changedProductIds: ['ozil5WuJ4qeSGhwcusPS'] })`. Assert:
- All 4 menus are rebuilt (scope resolution finds the product in a group shared by all menus)
- The product appears in 2 distinct `MenuGroup.productDisplayOrder` arrays

**TC3 — Scoped rebuild: product in 1 menu**

Product `hE0hUoKxy0KgplK5pfF8` ("Chicken 65") appears only in menu `TdGQqmNhA3AjNeoyYrQn` via group `SKoGd62OfNyZqMXqsKSX`. Call `rebuildMenus(bid, { changedProductIds: ['hE0hUoKxy0KgplK5pfF8'] })`. Assert:
- Only 1 menu (`TdGQqmNhA3AjNeoyYrQn`) is rebuilt
- Other 3 menus are untouched

**TC4 — Scoped rebuild: collection**

Collection `I6XLVNjKrBAcBEmqQV0q` ("signup") is referenced by 2 menus (`CcUqgkBxEnk1qYaNZ3K2`, `LShRjmDOXBNL7yVSD65V`) via `menuAssets` with `assetType: 'collection'`. Call `rebuildMenus(bid, { changedCollectionIds: ['I6XLVNjKrBAcBEmqQV0q'] })`. Assert:
- Only 2 menus are rebuilt
- Collection metadata in each rebuilt Menu has 7 fields matching source doc: `displayName: "signup "`, `name: "signup "`, `type: "loyaltySignup"`, `hyperlink: "://rewards"`, `imageGsls`, `videoGsls`, `isUserInteractionEnabled: false`

**TC10 — Collection metadata shape**

Collection `I6XLVNjKrBAcBEmqQV0q` in menu `CcUqgkBxEnk1qYaNZ3K2`. Assert rebuild produces 7-field metadata matching source Collection doc exactly:
- `displayName: "signup "`, `name: "signup "`, `type: "loyaltySignup"`, `hyperlink: "://rewards"`
- `imageGsls` matches source, `videoGsls` matches source
- `isUserInteractionEnabled: false`

**TC11 — Mirrored group preserves ordering**

Group `lWWo8L7WmEiEJuZgf3dM` has `mirrorCategoryId: "dKlTguVV2yNCVFJjH2sH"`. Assert:
- Group's `productDisplayOrder` matches Category's `productDisplayOrder` exactly (9 products, same order)
- Rebuild output preserves this ordering in the materialized Menu doc

## Verification

- `npm test` — all existing tests pass
- New unit tests for MenuRebuildService cover TC1-TC4, TC10-TC11
- New unit tests for AvailabilityService (write + concurrent merge)
- New unit tests for FeatureFlagService (cache TTL, defaults when doc missing)
- `npm run gcp-build` — TypeScript compilation succeeds
- Publish to Artifact Registry, then consuming services can build against the new version

## Deploy Notes

- Publish to Artifact Registry BEFORE any consuming service deploys
- Deploy Firestore single-field indexes on `syncTraceId` for 6 collections (products, optionSets, options, categories, taxRates, discounts) BEFORE square-gateway goes live
