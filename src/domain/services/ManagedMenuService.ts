import { PathResolver } from '../../persistence/firestore/PathResolver';
import { Provider } from '../../firestore-core/Constants';
import { createMenu } from '../surfaces/Menu';
import type { MenuAsset } from '../surfaces/Menu';
import { createMenuGroup } from '../surfaces/MenuGroup';
import type { MenuGroup } from '../surfaces/MenuGroup';
import { menuConverter, menuGroupConverter } from '../../persistence/firestore/converters/simpleConverters';
import { rebuildMenus } from './MenuRebuildService';

/**
 * #88 / #85: the "Square Menu" reconciler.
 *
 * Mirrors every non-deleted `categoryType: 'menu'` Category into a `managedBy: 'square'`
 * MenuGroup, assembles those groups onto a single `managedBy: 'square'` Menu named
 * "Square Menu", and then lets `rebuildMenus()` materialize it.
 *
 * This is a LEVEL-TRIGGERED reconciler, not an event handler: it takes only a businessId and
 * re-derives the whole desired state from the Categories collection on every run. Observe →
 * plan (pure) → apply the diff → let the existing deriver recompute the projection. A run that
 * finds nothing to change performs zero writes.
 *
 * FLAG-AGNOSTIC BY CONTRACT (#88): this service deliberately does NOT read the
 * `syncSquareMenuCategories` feature flag. Callers (the gateway / businesses cascade) gate on
 * it; a reconciler that reads its own enablement flag becomes edge-triggered and untestable,
 * and could not be invoked directly from a test or a one-off backfill. Do not add a flag read
 * here — add the gate at the call site.
 */

const MANAGED_MENU_NAME = 'Square Menu';
const MANAGED_BY = Provider.square; // 'square'

/** Same shape `MenuRebuildService` uses for a raw Firestore doc: id plus untyped data. */
interface DocData {
  id: string;
  data: FirebaseFirestore.DocumentData;
}

/** A query snapshot as `DocData[]`, with soft-deleted documents dropped. */
function toLiveDocs(snapshot: FirebaseFirestore.QuerySnapshot): DocData[] {
  return snapshot.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((d) => !d.data.isDeleted);
}

/** One entry of the desired managed set — the group id plus the mirror category it came from. */
interface ManagedGroupPlanEntry {
  groupId: string;
  categoryId: string;
  categoryName: string;
}

interface ReconciliationPlan {
  /** Managed groups that do not exist yet, already built as domain entities. */
  creates: Array<{ group: MenuGroup; categoryId: string; categoryName: string }>;
  /** Existing doc ids to stamp `managedBy = 'square'` (adopt in place — never re-create). */
  converts: string[];
  /** Existing doc ids to stamp `managedBy = null` (demote in place — never delete). */
  demotes: string[];
  /** The full desired managed set, unordered here; `computeAssemblyOrder` orders it. */
  managed: ManagedGroupPlanEntry[];
  /** Categories mirrored by more than one group, for the collision warning. */
  duplicateCategoryIds: string[];
}

interface MenuAssembly {
  menuAssets: Record<string, MenuAsset>;
  groupDisplayOrder: string[];
  menuAssetDisplayOrder: string[];
}

/**
 * #88: winner selection among the groups that mirror one category. Prefer a group that is
 * already `managedBy: 'square'` (so a steady-state run never flips which doc is managed), then
 * the lexicographically lowest doc id (so the choice is deterministic across runs and
 * independent of Firestore's document ordering).
 */
function pickWinner(candidates: DocData[]): DocData | undefined {
  let winner: DocData | undefined;
  for (const candidate of candidates) {
    if (!winner) {
      winner = candidate;
      continue;
    }
    const isCandidateManaged = candidate.data.managedBy === MANAGED_BY;
    const isWinnerManaged = winner.data.managedBy === MANAGED_BY;
    if (isCandidateManaged !== isWinnerManaged) {
      if (isCandidateManaged) winner = candidate;
      continue;
    }
    if (candidate.id < winner.id) winner = candidate;
  }
  return winner;
}

/**
 * #88: the whole diff, computed purely — no I/O, no Firestore types beyond the raw doc data.
 * Keeping this a pure function is what makes the reconciliation logic testable in isolation
 * (the `CatalogCascadeService` compute/apply split, applied here).
 *
 * @param categories non-deleted Categories with `categoryType === 'menu'`
 * @param groups every non-deleted MenuGroup in the business
 */
function planReconciliation(categories: DocData[], groups: DocData[]): ReconciliationPlan {
  const creates: ReconciliationPlan['creates'] = [];
  const converts: string[] = [];
  const demotes: string[] = [];
  const managed: ManagedGroupPlanEntry[] = [];
  const duplicateCategoryIds: string[] = [];

  // Index the live groups by mirrorCategoryId. A group with a null/empty mirrorCategoryId can
  // never be matched or converted — legacy operator groups predate the field, and adopting one
  // by name would silently seize an operator-owned doc.
  const groupsByCategoryId = new Map<string, DocData[]>();
  for (const group of groups) {
    const mirrorCategoryId = group.data.mirrorCategoryId;
    if (typeof mirrorCategoryId !== 'string' || mirrorCategoryId === '') continue;
    const bucket = groupsByCategoryId.get(mirrorCategoryId);
    if (bucket) bucket.push(group);
    else groupsByCategoryId.set(mirrorCategoryId, [group]);
  }

  const winnerIds = new Set<string>();

  for (const category of categories) {
    const categoryName: string = category.data.name ?? '';
    const candidates = groupsByCategoryId.get(category.id) ?? [];
    if (candidates.length > 1) duplicateCategoryIds.push(category.id);

    const winner = pickWinner(candidates);

    if (!winner) {
      // productDisplayOrder stays [] on purpose: a mirror group's effective product list lives
      // on the mirror CATEGORY and is resolved at materialization time by
      // `effectiveGroupProductIds()` (#79). Pre-filling it here would create a second, stale
      // copy of the truth that the two paths could drift apart on.
      const group = createMenuGroup({
        name: categoryName,
        displayName: categoryName,
        mirrorCategoryId: category.id,
        managedBy: MANAGED_BY,
      });
      creates.push({ group, categoryId: category.id, categoryName });
      managed.push({ groupId: group.Id, categoryId: category.id, categoryName });
      continue;
    }

    winnerIds.add(winner.id);
    // Adopt in place. `converts` never includes a group that is already managed, so a
    // steady-state run produces an empty plan and therefore zero writes.
    if (winner.data.managedBy !== MANAGED_BY) converts.push(winner.id);
    managed.push({ groupId: winner.id, categoryId: category.id, categoryName });
  }

  // #88 — THE SINGLE ORPHAN RULE:
  //   every non-deleted MenuGroup with managedBy === 'square' that is NOT a winner for a live
  //   menu category is demoted (managedBy = null, mirrorCategoryId retained, doc never deleted)
  //   and is absent from the assembly.
  //
  // One sentence, no branches, and it subsumes all four cases the issue lists separately:
  //   1. the mirror category document no longer exists;
  //   2. the mirror category was soft-deleted (isDeleted);
  //   3. the mirror category was demoted to 'regular' / 'kitchen';
  //   4. two managed groups mirror the same category — the loser is by definition not the
  //      winner, so it self-heals to unmanaged with no special case.
  // Non-managed losers are never touched: they are operator-owned groups whose managedBy is
  // already null, so "demoting" them would be a pure no-op write. Retaining mirrorCategoryId
  // means re-promoting a category re-adopts the very same doc instead of creating a duplicate.
  for (const group of groups) {
    if (group.data.managedBy === MANAGED_BY && !winnerIds.has(group.id)) demotes.push(group.id);
  }

  return {
    creates, converts, demotes, managed, duplicateCategoryIds,
  };
}

/**
 * #88: the single source of truth for the Square Menu's asset order. Sorted by the mirrored
 * category's `name`, tie-broken by category id, so the order is deterministic and stable across
 * runs regardless of Firestore's document order.
 *
 * Deliberately NOT `localeCompare`: its result depends on the runtime's ICU data and default
 * locale, so two Node builds (or a container with a trimmed ICU) would produce different orders
 * for the same input — which makes "deterministic and stable across runs" false and produces
 * pointless menu rewrites. Plain codepoint comparison is stable everywhere.
 *
 * `_existingMenuAssetDisplayOrder` is intentionally unused today. It is the seam for #100 /
 * remy#349 (preserve an operator-set order and append only the newcomers): that issue replaces
 * this function body and nothing else in the service moves. Do NOT pre-implement it here.
 */
function computeAssemblyOrder(
  managedGroups: ManagedGroupPlanEntry[],
  _existingMenuAssetDisplayOrder: string[],
): string[] {
  return [...managedGroups]
    .sort((a, b) => {
      if (a.categoryName < b.categoryName) return -1;
      if (a.categoryName > b.categoryName) return 1;
      if (a.categoryId < b.categoryId) return -1;
      if (a.categoryId > b.categoryId) return 1;
      return 0;
    })
    .map((entry) => entry.groupId);
}

/**
 * #88: the ONLY place the Square Menu's three membership/ordering fields are produced, so no
 * consumer can ever see a third answer.
 *
 * All three must be written, as identical sequences:
 * - `menuAssets` is what `attemptRebuild` derives membership from (`MenuRebuildService.ts:344`);
 * - `menuAssetDisplayOrder` is what Remy actually renders — `MenuGroupList.tsx:176` feeds the
 *   list with `menu.menuAssetDisplayOrder ?? []` and `:150` derives the count from it — and
 *   `rebuildMenus` only ever FILTERS that array, never derives it, so leaving it empty renders
 *   an empty Square Menu;
 * - `groupDisplayOrder` is the legacy order, kept in sync for older readers.
 *
 * Consequence, and it is intended: the assembly is exactly the managed group set, so any
 * non-group asset (collection / product / htmlText) placed on the Square Menu is dropped. The
 * Square Menu is UI-locked read-only per #85, so operators cannot put one there.
 */
function buildAssembly(order: string[]): MenuAssembly {
  const menuAssets: Record<string, MenuAsset> = {};
  for (const id of order) menuAssets[id] = { assetType: 'group' };
  return {
    menuAssets,
    groupDisplayOrder: [...order],
    menuAssetDisplayOrder: [...order],
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * #88: no-churn guard for the reuse path — the menu doc is only updated when the assembly
 * actually differs, so a steady-state run writes nothing.
 *
 * This mirrors the idea of `menuAssetsEqual` (`MenuRebuildService.ts:310-329`) rather than
 * reusing the function: it is not exported, and exporting it purely for this caller would widen
 * `MenuRebuildService`'s public surface for no benefit. The comparison here is also narrower on
 * purpose — every asset we write is `{ assetType: 'group' }` with no `configuration`, so there
 * is nothing else to compare.
 */
function assemblyEquals(
  existingData: FirebaseFirestore.DocumentData,
  assembly: MenuAssembly,
): boolean {
  const existingAssets: Record<string, MenuAsset> = existingData.menuAssets ?? {};
  const existingKeys = Object.keys(existingAssets);
  const desiredKeys = Object.keys(assembly.menuAssets);
  if (existingKeys.length !== desiredKeys.length) return false;
  for (const id of desiredKeys) {
    const existing = existingAssets[id];
    if (!existing || existing.assetType !== assembly.menuAssets[id].assetType) return false;
  }
  return arraysEqual(existingData.menuAssetDisplayOrder ?? [], assembly.menuAssetDisplayOrder)
    && arraysEqual(existingData.groupDisplayOrder ?? [], assembly.groupDisplayOrder);
}

/**
 * Reconciles the business's "Square Menu" with its `categoryType: 'menu'` Categories and
 * materializes the result.
 *
 * Idempotent: a run that finds the desired state already in place performs zero document
 * writes (the trailing `rebuildMenus` rewrites the menu byte-identically).
 *
 * @param businessId the tenant to reconcile
 * @returns the managed Menu's id, and the managed MenuGroup ids **in Square-Menu assembly
 *   order** — the same array as the menu's `menuAssetDisplayOrder`, so a caller can log or
 *   assert the order without re-reading Firestore
 * @throws Error prefixed `[ManagedMenuService]` when the business has more than one live
 *   `managedBy: 'square'` Menu; nothing is written in that case
 */
export async function syncManagedSquareMenu(
  businessId: string,
): Promise<{ menuId: string; managedGroupIds: string[] }> {
  // One timestamp for the whole run, so every doc this run touches carries the same `updated`.
  // Timestamps are ISO strings throughout this repo (`baseFieldsToFirestore` emits
  // `.toISOString()`), never Firestore Timestamps.
  const nowIso = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // Phase A — observe. Three reads, all issued before any write.
  // ---------------------------------------------------------------------------
  const [categorySnap, groupSnap, menuSnap] = await Promise.all([
    // Single-field equality query, so no composite index is needed. Legacy Category docs have
    // no `categoryType` field at all and therefore never match — the desired-state input is
    // correct by construction, with no `?? 'regular'` special case. 'kitchen' is excluded free.
    PathResolver.categoriesCollection(businessId).where('categoryType', '==', 'menu').get(),
    // FULL collection read on purpose. A `where('mirrorCategoryId', 'in', …)` query (the
    // gateway's approach) would need 30-id chunking AND would miss orphaned managed groups
    // whose category no longer exists — precisely the set the orphan rule has to find. These
    // collections are tens of docs, so the full read is both simpler and strictly more correct.
    PathResolver.menuGroupsCollection(businessId).get(),
    PathResolver.menusCollection(businessId).where('managedBy', '==', MANAGED_BY).get(),
  ]);

  // `isDeleted` is filtered IN MEMORY (by `toLiveDocs`), deliberately not as a second `where()`:
  // combining it with the equality clauses above would require a composite index, and until that
  // index is built Firestore returns an empty result set — the reconciler would silently see no
  // categories and demote every managed group. In-memory filtering has no such failure mode.
  const categories = toLiveDocs(categorySnap);
  const groups = toLiveDocs(groupSnap);
  const managedMenus = toLiveDocs(menuSnap);

  // ---------------------------------------------------------------------------
  // Phase B — validate the invariant, still before the first write.
  // ---------------------------------------------------------------------------
  // Placement is the point: failing here leaves an invariant-violating business COMPLETELY
  // untouched rather than half-reconciled against an arbitrarily chosen menu. Precedent:
  // `LinkedObjectQueries.ts:42-47` throws the same way on a duplicate linked object.
  if (managedMenus.length > 1) {
    throw new Error(
      `[ManagedMenuService] more than one managedBy:'${MANAGED_BY}' Menu for business ${businessId}: `
      + `${managedMenus.map((m) => m.id).join(', ')}`,
    );
  }
  // Identity is `managedBy === 'square'` ONLY, never the name. If the single managed menu was
  // renamed by an operator we reuse it as-is and do not rename it back — name drift is out of
  // scope. `MANAGED_MENU_NAME` is used on create and nowhere else. An isDeleted managed Menu is
  // invisible here: neither reused nor counted, so a business that soft-deleted its Square Menu
  // simply gets a fresh one on the next run.
  const existingMenu: DocData | undefined = managedMenus[0];

  // ---------------------------------------------------------------------------
  // Phase C — plan (pure).
  // ---------------------------------------------------------------------------
  const plan = planReconciliation(categories, groups);

  if (plan.duplicateCategoryIds.length > 0) {
    console.warn('[ManagedMenuService] duplicate mirrorCategoryId groups', {
      businessId,
      categoryIds: plan.duplicateCategoryIds,
    });
  }

  // ---------------------------------------------------------------------------
  // Phase D — apply the group writes, BEFORE the menu assembly.
  // ---------------------------------------------------------------------------
  // Ordering rationale: the menu must never reference a MenuGroup doc that does not exist yet.
  // A dangling ref is pruned by `pruneDanglingAssetRefs` on the very next rebuild, so the group
  // would flap in and out of the menu on alternating runs. Writing groups first makes every
  // crash point re-runnable instead: an extra un-referenced managed group is re-adopted (or
  // demoted) next run, and a demoted-but-still-listed group is dropped from the assembly next
  // run.
  //
  // Sequential awaits, no `db.batch()` / `BulkWriter`: there is no precedent for either
  // anywhere in `src/`, and `rebuildMenus` opens its own transactions immediately afterwards,
  // so end-to-end atomicity is unreachable regardless of how these writes are grouped.
  const groupsRef = PathResolver.menuGroupsCollection(businessId);
  for (const { group } of plan.creates) {
    await groupsRef.doc(group.Id).set(menuGroupConverter.toFirestore(group));
  }
  // NARROW update(), not a converter round-trip: `toFirestore` would rewrite every field,
  // re-serialize `created`, and clobber `products` / `productDisplayOrder` written by the
  // gateway. A managed-state flip is a genuine mutation, so `updated` is bumped with it; a
  // no-op run reaches neither loop and writes nothing at all.
  for (const id of plan.converts) {
    await groupsRef.doc(id).update({ managedBy: MANAGED_BY, updated: nowIso });
  }
  for (const id of plan.demotes) {
    await groupsRef.doc(id).update({ managedBy: null, updated: nowIso });
  }

  // ---------------------------------------------------------------------------
  // Phase E — resolve-or-create the Menu and write the assembly.
  // ---------------------------------------------------------------------------
  const order = computeAssemblyOrder(plan.managed, existingMenu?.data.menuAssetDisplayOrder ?? []);
  const assembly = buildAssembly(order);
  const menusRef = PathResolver.menusCollection(businessId);

  let menuId: string;
  let isAssemblyChanged: boolean;
  if (!existingMenu) {
    // #88 (R10): `Menu.groups` is deliberately NOT written here — `createMenu` leaves it `{}`
    // and the update path never touches it. `rebuildMenus` overwrites `groups` wholesale from
    // the freshly-read MenuGroup/Category/Product docs (`MenuRebuildService.ts:443`), so
    // anything written here would be dead work — and worse, would make this service a SECOND
    // writer of a materialized projection, which is exactly the drift hazard #79 warns about.
    // `{}` is self-consistent ("not yet materialized") and Phase F runs unconditionally below.
    const menu = createMenu({
      name: MANAGED_MENU_NAME,
      displayName: MANAGED_MENU_NAME,
      managedBy: MANAGED_BY,
      ...assembly,
    });
    await menusRef.doc(menu.Id).set(menuConverter.toFirestore(menu));
    menuId = menu.Id;
    isAssemblyChanged = true;
  } else {
    menuId = existingMenu.id;
    isAssemblyChanged = !assemblyEquals(existingMenu.data, assembly);
    if (isAssemblyChanged) {
      await menusRef.doc(menuId).update({ ...assembly, updated: nowIso });
    }
  }

  // Log only when something actually happened. This runs on every catalog sync, so a per-run
  // line on the no-change path would drown the signal — same reasoning as
  // `MenuRebuildService.ts:457`, which warns only when it actually pruned something.
  if (
    plan.creates.length > 0
    || plan.converts.length > 0
    || plan.demotes.length > 0
    || isAssemblyChanged
  ) {
    console.warn('[ManagedMenuService] reconciled Square Menu', {
      businessId,
      menuId,
      created: plan.creates.length,
      converted: plan.converts.length,
      demoted: plan.demotes.length,
      assemblySize: order.length,
    });
  }

  // ---------------------------------------------------------------------------
  // Phase F — materialize, unconditionally.
  // ---------------------------------------------------------------------------
  // Unconditional by design. The managed group SET can be unchanged while a mirror category's
  // `productDisplayOrder` changed, and materialization is an acceptance criterion — skipping
  // the rebuild "for idempotency" would be an anti-optimisation that leaves the menu stale.
  // `rebuildMenus` rewrites the menu byte-identically on a no-change run, so this costs no
  // churn. It also cannot be a silent no-op here: `rebuildMenus` bulk-reads all menus and
  // filters the scoped ids against that read (`MenuRebuildService.ts:134`), and by this point
  // the Square Menu doc is guaranteed to exist — which is precisely why Phase E comes first.
  await rebuildMenus(businessId, { menuIds: [menuId] });

  return { menuId, managedGroupIds: order };
}
