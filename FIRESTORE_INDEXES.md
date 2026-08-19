# Firestore index configuration

There is **no `firestore.indexes.json`** in this repo or any sibling repo in the KIOS monorepo.
Index configuration — and TTL field policies, see **TTL policies** below — is applied
**imperatively against the live projects** with `gcloud`, so nothing in version control reflects it.
This file is the record. Keep it current when you change index config, because there is no other
place to look.

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

## TTL policies

TTL field policies are configured the same way as index exemptions — imperatively, with `gcloud`,
against the live projects — so nothing in version control reflects them either. They are recorded
here for the same reason: there is no other place to look.

### `webhookClaims.expiresAt` (P42 — rcc#166, contract rcc#165)

`webhookClaims/{eventId}` is a **top-level** collection of webhook claim documents. Each claim
carries an `expiresAt` Timestamp (72 h after `createdAt`), and the collection group needs a TTL
policy on that field so Firestore reclaims the stored Square notification `payload` once the replay
window has passed. Note the command group is `firestore fields ttls`, not `firestore indexes fields`.

```
# dev
gcloud firestore fields ttls update expiresAt \
  --collection-group=webhookClaims --database='(default)' \
  --project=project-arya-280418 --enable-ttl
```

```
# prod
gcloud firestore fields ttls update expiresAt \
  --collection-group=webhookClaims --database='(default)' \
  --project=kios-master --enable-ttl
```

Each returns a long-running operation; wait for it to finish. Apply to dev first, verify, then prod
— the same ordering the index work above uses.

**Re-verify.** The `ttls` group exposes only `update` (no `describe`/`list`), so verification goes
through the field-metadata describe, which is where `ttlConfig` appears:

```
gcloud firestore indexes fields describe expiresAt \
  --collection-group=webhookClaims --database='(default)' --project=<project>
```

Expect a `ttlConfig` in an active state. **Only one field per collection group can be the TTL
field** — pointing the policy at a different field replaces this one, it does not add a second.

### TTL is storage reclamation only, never a correctness mechanism

Two caveats from Firebase's docs, both load-bearing:

- deletion happens *"typically within 24 hours after its expiration date"*, and
- *"Expired documents continue to appear in queries and lookup requests until the TTL process
  actually deletes them."*

So a document being past `expiresAt` says nothing about whether it still exists, and a document
existing says nothing about whether it is still live. Consequences:

- Claim expiry is always evaluated from the **stored** `leaseExpiresAt` / `expiresAt` fields at read
  time. It is never inferred from TTL having run.
- The P42 sweeper (kiosinc/cloud-functions#82) must filter on those stored fields. A query that
  assumes expired claims are gone will see them for up to a day past expiry.

### P42 rollout notes

**The `preferRest` precondition — check before rolling out.** `firebase/firebase-admin-node#2587`
(still open): under REST transport the Firestore endpoint returns HTTP 409 both for "document
already exists" and for a server-aborted request, the SDK cannot distinguish the two, so it retries.
`DocumentReference.create()` on an existing document therefore **hangs until timeout instead of
failing fast** — and `acquireClaim` depends on that fast fail to detect a duplicate. `preferRest` is
not only a code setting: it is also read from the **`FIRESTORE_PREFER_REST` environment variable**.
Pre-rollout check, in both **square-gateway-claude** and **cloud-functions**:

```
grep -rn "preferRest\|initializeFirestore" src
gcloud run services describe <svc> --region=<r> \
  --project=<kios-master|project-arya-280418> \
  --format='value(spec.template.spec.containers[0].env)'
```

Expect zero `preferRest: true` and `FIRESTORE_PREFER_REST` unset. If either is set, **block the
rollout** until it is removed.

**The flag rollout.** P42 declares **two** flags in `WriteModelFlags`, and they roll out in opposite
directions. Do not conflate them.

| Flag | Default | Consumed by | Rollout |
|---|---|---|---|
| `useClaimLease` | `false` | the six square-gateway-claude webhook handlers and the two cloud-functions consumers | write the doc field only when a handler migration is ready to use it |
| `writeLegacyEventNotification` | `true` | `restaurant/webhooks/WebhookClaim` (library-internal) | leave absent for the whole migration window; writing `false` is the rcc#167 retirement step |

- `useClaimLease` gates whether a consumer uses the claim/lease at all. After this merge there
  should be **no** `useClaimLease` field in `/config/writeModelFlags` in either project — absent must
  mean false. Rollback is flipping the field off.
- `writeLegacyEventNotification` gates the legacy-RTDB dual-write **inside** `acquireClaim`, and it
  defaults to **`true`** — absent means **on**. That is what makes a `useClaimLease` rollback a pure
  flag flip, so it must stay on (i.e. stay absent) for as long as any consumer might roll back.
  Setting it to `false` is the rcc#167 retirement step and must not be done before then. If the flag
  read itself fails, `acquireClaim` falls back to **on** and warns: ON preserves rollback protection,
  OFF loses it silently, and the claim is already committed by that point.

It is a feature flag rather than a library constant deliberately: retirement is then **one boolean
per GCP project**, not a restaurant-core-claude publish plus a version repin and a redeploy in
square-gateway-claude and cloud-functions. It is read only on the dual-write path, so it adds no
Firestore reads to duplicate deliveries.

**The pre-resolution dual-write gap.** During the migration window `acquireClaim` also writes the
legacy RTDB `EventNotification` node, so a flag rollback is safe. But the legacy key is
`${businessId}_${eventId}`, so when a claim is taken **before** tenant resolution (`businessId` not
yet known) the dual-write is deliberately skipped rather than writing an `undefined_<eventId>` node
that a rolled-back handler would never look up. Consequence: an event claimed pre-resolution is
**not rollback-protected**. Handler migrations that care about the rollback window should claim
after tenant resolution.

**`payload` fidelity limits.** The claim stores the Square notification body verbatim, as a
Firestore **map**, and it is the only durable replay source: Square's Events API is unavailable to
us and Cloud Tasks has no DLQ, so kiosinc/cloud-functions#83 replays from this field. What is
promised is **semantic** fidelity — no field selection and no value transformation — and explicitly
**not** byte fidelity, so a stored payload **cannot** be re-verified against Square's HMAC
signature: verification stays at the receiver (kiosinc/webhook-receiver#36) and the replay job must
not attempt it. The full contract, including the limits Firestore itself imposes on map keys and
nested arrays, is the *Payload fidelity limits* section of
`src/restaurant/webhooks/WebhookClaim.ts`; it is deliberately not restated here so the two cannot
drift. Payloads are reclaimed by the 72 h `expiresAt` TTL above.
