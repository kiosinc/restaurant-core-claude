# Firestore index configuration

There is **no `firestore.indexes.json`** in this repo or any sibling repo in the KIOS monorepo.
Index configuration is applied **imperatively against the live projects** with `gcloud`, so nothing
in version control reflects it. This file is the record. Keep it current when you change index
config, because there is no other place to look.

## Single-field exemptions on the `products` map

`Category.products` and `MenuGroup.products` are maps keyed by product id whose values are
`ProductMeta` (`src/domain/catalog/Product.ts`). Firestore indexes every subfield of a map by
default, so each product membership costs roughly one index entry per `ProductMeta` field — on
categories holding thousands of products that dominates write cost and pushes documents toward the
per-document index-entry ceiling. Nothing queries the map, so the indexes are pure overhead.

**Exemptions on a map field inherit to its subfields.** Exempting the `products` field path covers
the dynamic product-id keys and all `ProductMeta` fields at once, and any future `ProductMeta`
field is covered automatically with no further action.

### Live state (verified 2026-08-14 via `gcloud firestore indexes fields describe`)

| project | `categories` / `products` | `menuGroups` / `products` | either / `productDisplayOrder` |
|---|---|---|---|
| dev `project-arya-280418` | explicit override carrying the full ASCENDING + DESCENDING + ARRAY_CONTAINS set — **NOT exempt** | inherits `__default__/*` (`usesAncestorConfig: true`) — **NOT exempt** | inherits default; ASC + DESC + CONTAINS; READY — **indexed** |
| prod `kios-master` | explicit override with **no** `indexes` array — **ALREADY EXEMPT** | inherits `__default__/*` (`usesAncestorConfig: true`) — **NOT exempt** | inherits default; ASC + DESC + CONTAINS; READY — **indexed** |

Two things worth stating plainly, because they are easy to get wrong:

- **dev and prod are divergent today.** Prod's `categories/products` is already exempt; dev's is
  not. Remaining work on that field path is dev-only. There is no detection mechanism for this
  divergence — re-run the `describe` command below rather than assuming the two match.
- **`menuGroups/products` is unexempt in BOTH projects.** `MenuGroup.products` carries the same
  `ProductMeta` shape as `Category.products`, so the exemption must cover **two** collection
  groups, not just `categories`.

### Operator commands

```
# dev
gcloud firestore indexes fields update products --collection-group=categories  --project=project-arya-280418 --disable-indexes
gcloud firestore indexes fields update products --collection-group=menuGroups  --project=project-arya-280418 --disable-indexes

# prod (categories is already exempt — menuGroups is not)
gcloud firestore indexes fields update products --collection-group=menuGroups  --project=kios-master --disable-indexes
```

Each returns a long-running operation; wait for it to finish. Apply to dev first, verify, then
prod.

### Re-verify

```
gcloud firestore indexes fields describe products --collection-group=categories --project=<project>
gcloud firestore indexes fields describe products --collection-group=menuGroups --project=<project>
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
different collection groups, so the `products`-map exemptions above are safe — but do not
generalize the reasoning to another map without checking its call sites first. A useful smoke
check after any exemption work: `where('optionSets.{id}.name', '>=', '')` on `products` still
returns rows.
