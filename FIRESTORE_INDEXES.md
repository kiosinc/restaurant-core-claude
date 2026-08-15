# Firestore index configuration

There is **no `firestore.indexes.json`** in this repo or any sibling repo in the KIOS monorepo.
Index configuration is applied **imperatively against the live projects** with `gcloud`, so nothing
in version control reflects it. This file is the record. Keep it current when you change index
config, because there is no other place to look.

## Single-field exemptions on the per-product maps

Category and MenuGroup each carry **two** maps keyed by product id, and both need exempting:

- **`products`** — values are `ProductMeta` (`src/domain/catalog/Product.ts`).
- **`productOrdinals`** — values are plain numbers, Square's per-membership item ordinal
  (`Category.productOrdinals`, `MenuGroup.productOrdinals`).

Firestore indexes every subfield of a map by default, so each product membership costs roughly one
index entry per `ProductMeta` field in `products`, plus one more for its `productOrdinals` entry —
on categories holding thousands of products that dominates write cost and pushes documents toward
the per-document index-entry ceiling. Nothing queries either map, so the indexes are pure overhead.

**Exemptions on a map field inherit to its subfields.** Exempting the `products` field path covers
the dynamic product-id keys and all `ProductMeta` fields at once, and any future `ProductMeta`
field is covered automatically with no further action. Exempting `productOrdinals` likewise covers
every product-id key under it.

### Live state (verified 2026-08-14 via `gcloud firestore indexes fields describe`)

| project | `categories` / `products` | `menuGroups` / `products` | either / `productDisplayOrder` |
|---|---|---|---|
| dev `project-arya-280418` | explicit override carrying the full ASCENDING + DESCENDING + ARRAY_CONTAINS set — **NOT exempt** | inherits `__default__/*` (`usesAncestorConfig: true`) — **NOT exempt** | inherits default; ASC + DESC + CONTAINS; READY — **indexed** |
| prod `kios-master` | explicit override with **no** `indexes` array — **ALREADY EXEMPT** | inherits `__default__/*` (`usesAncestorConfig: true`) — **NOT exempt** | inherits default; ASC + DESC + CONTAINS; READY — **indexed** |

`productOrdinals` is deliberately absent from that table: it is a **new** field path introduced with
this change, so by definition it carries no override in either project and inherits `__default__/*`
— i.e. **unexempt in both dev and prod**, on both `categories` and `menuGroups`. That is a
statement about how Firestore treats a field path nobody has configured, not a live reading.

Three things worth stating plainly, because they are easy to get wrong:

- **dev and prod are divergent today.** Prod's `categories/products` is already exempt; dev's is
  not. Remaining work on that field path is dev-only. There is no detection mechanism for this
  divergence — re-run the `describe` command below rather than assuming the two match.
- **`menuGroups/products` is unexempt in BOTH projects.** `MenuGroup.products` carries the same
  `ProductMeta` shape as `Category.products`, so the exemption must cover **two** collection
  groups, not just `categories`.
- **`productOrdinals` needs all four combinations.** Unlike `products`, nothing is already done for
  it, so it takes two collection groups × two projects.

### Operator commands

```
# dev
gcloud firestore indexes fields update products         --collection-group=categories  --project=project-arya-280418 --disable-indexes
gcloud firestore indexes fields update products         --collection-group=menuGroups  --project=project-arya-280418 --disable-indexes
gcloud firestore indexes fields update productOrdinals  --collection-group=categories  --project=project-arya-280418 --disable-indexes
gcloud firestore indexes fields update productOrdinals  --collection-group=menuGroups  --project=project-arya-280418 --disable-indexes

# prod (categories is already exempt — menuGroups is not)
gcloud firestore indexes fields update products         --collection-group=menuGroups  --project=kios-master --disable-indexes
gcloud firestore indexes fields update productOrdinals  --collection-group=categories  --project=kios-master --disable-indexes
gcloud firestore indexes fields update productOrdinals  --collection-group=menuGroups  --project=kios-master --disable-indexes
```

Each returns a long-running operation; wait for it to finish. Apply to dev first, verify, then
prod.

### Re-verify

```
gcloud firestore indexes fields describe products        --collection-group=categories --project=<project>
gcloud firestore indexes fields describe products        --collection-group=menuGroups --project=<project>
gcloud firestore indexes fields describe productOrdinals --collection-group=categories --project=<project>
gcloud firestore indexes fields describe productOrdinals --collection-group=menuGroups --project=<project>
```

Exempt looks like an override with **no** `indexes` entries and `usesAncestorConfig` absent or
false.

## Why `productDisplayOrder` stays indexed

`productDisplayOrder` is a **separate top-level field path** — the commands above do not touch it,
and it must stay indexed. Three live array-membership call sites depend on it — `array-contains`
and `array-contains-any` both read the same single-field index:

- `src/persistence/firestore/handlers/catalogHandlers.ts` —
  `parentQuery: (p) => ['productDisplayOrder', 'array-contains', p.Id]`, shared by both the
  categories and the menuGroups handler, i.e. by `ProductCompositeHandler`.
- `square-gateway-claude/src/controllers/sync/mappers/product.ts` — `array-contains`.
- `square-gateway-claude/src/controllers/sync/shared/pageMembershipReconcile.ts` —
  `array-contains-any` over a page's product ids, on the P39 page-level write path.

After applying an exemption, confirm these still work: run
`where('productDisplayOrder', 'array-contains', <productId>)` against `categories` and against
`menuGroups` and check the expected parents return with no `FAILED_PRECONDITION`.

## Caveat — "exempt the map, nothing needs it" is not a general rule

Other map fields in this codebase **do** rely on recursive map-subfield indexing.
`catalogHandlers.ts` issues `where('optionSets.{id}.name', '>=', '')` against the **products**
collection group and `where('options.{id}.name', '>=', '')` against **optionSets**. Those are
different collection groups, so the per-product-map exemptions above are safe — but do not
generalize the reasoning to another map without checking its call sites first. A useful smoke
check after any exemption work: `where('optionSets.{id}.name', '>=', '')` on `products` still
returns rows.
