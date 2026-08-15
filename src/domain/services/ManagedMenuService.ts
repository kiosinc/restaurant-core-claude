import { PathResolver } from '../../persistence/firestore/PathResolver';
import { Provider } from '../../firestore-core/Constants';
import { createMenu } from '../surfaces/Menu';
import type { MenuAsset } from '../surfaces/Menu';
import { createMenuGroup } from '../surfaces/MenuGroup';
import type { MenuGroup } from '../surfaces/MenuGroup';
import { menuConverter, menuGroupConverter } from '../../persistence/firestore/converters/simpleConverters';
import { rebuildMenus } from './MenuRebuildService';

/**
 * #174 / #85 Amendment 1: the Square menu MIRROR.
 *
 * Square models menus as a two-level tree built entirely out of `MENU_CATEGORY` objects,
 * distinguished by `is_top_level` / `parent_category.id`. This service mirrors that tree:
 *
 *   Square root menu-category  →  KIOS `Menu`      bound by `Menu.mirrorCategoryId`
 *   Square child menu-category →  KIOS `MenuGroup` bound by `MenuGroup.mirrorCategoryId`
 *
 * and then lets `rebuildMenus()` materialize the result. N roots produce N managed Menus —
 * Kreation has 34 — so more than one `managedBy: 'square'` Menu is the EXPECTED state.
 *
 * This is a LEVEL-TRIGGERED reconciler, not an event handler: it takes only a businessId and
 * re-derives the whole desired state from the Categories collection on every run. Observe →
 * plan (pure) → apply the diff → let the existing deriver recompute the projection. A run that
 * finds nothing to change performs zero writes.
 *
 * OWNERSHIP — the mirror creates and owns ONLY its own entities. There is no adoption: a group
 * the operator built by hand for the same Square category is never read, converted, reordered or
 * deleted, even though its `mirrorCategoryId` matches. The accepted, documented tradeoff is that
 * the operator then sees two rows — theirs and the managed one. Inventing names or silently
 * merging would break the mirror contract.
 *
 * DELETE, DON'T DEMOTE — a root that disappears from Square takes its managed Menu and that
 * menu's managed groups with it; a child that disappears takes its group. Demotion
 * (`managedBy → null`, doc retained) is deliberately NOT a state this service can produce.
 * Per #79 a group's effective product list is the mirror CATEGORY's `productDisplayOrder` when
 * `mirrorCategoryId` is set and that category exists; a demoted group whose category was deleted
 * falls through to the group's OWN, now permanently stale list — a frozen ghost sitting in an
 * operator's menu with no live source and no signal that it is dead.
 *
 * What deletion COSTS, stated plainly because the tradeoff is real and was accepted knowingly:
 * a delete destroys the doc IDENTITY, not just the doc. The lost position is NOT part of the cost —
 * order is re-derived from Square every run (#183), so a re-created category's group returns to its
 * own ordinal slot. What is actually lost is the id: an operator's own Menu that listed the old
 * group id is left with a dangling reference until `pruneDanglingAssetRefs` sweeps it, and a
 * re-created Menu comes back with default presentation fields (cover images, gratuity rates). That
 * is the right trade when "gone" means the merchant deleted it in Square — and it is why this
 * service must only ever run against a COMPLETE catalog read (see `resolveRootId`).
 *
 * FULL OWNERSHIP (#183): this reconciler owns MEMBERSHIP (which group ids are on which menu) AND
 * ORDER (the sequence they appear in). Both are re-derived from the catalog on every run, out of
 * Square's `parent_category.ordinal`; nothing on the menu doc is an input to either. #183 withdrew
 * #100 / remy#349's carve-out, which had made order operator-owned and OBSERVED from the menu doc.
 * With Remy's reorder control gone (remy#471) that observation no longer protected operator intent
 * — it froze Square's order forever, because the value observed is the one the PREVIOUS run wrote.
 *
 * FLAG-AGNOSTIC BY CONTRACT (#88): this service deliberately does NOT read the
 * `syncSquareMenuCategories` feature flag. Callers (the gateway / businesses cascade) gate on
 * it; a reconciler that reads its own enablement flag becomes edge-triggered and untestable,
 * and could not be invoked directly from a test or a one-off backfill. Do not add a flag read
 * here — add the gate at the call site.
 */

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

/** One node of the mirrored Square tree, read out of raw Category doc data. */
interface CategoryNode {
  id: string;
  name: string;
  parentCategoryId: string | null;
  parentOrdinal: number | null;
  /**
   * `isTopLevel !== false`, i.e. ABSENT COUNTS AS TRUE — matching `createCategory`'s default.
   * Every Category doc written before #173 predates the Square menu tree and is therefore flat,
   * i.e. parentless, so a legacy doc is a root and mirrors to a Menu of its own.
   */
  isTopLevel: boolean;
}

/** One entry of a menu's desired group set. */
interface ManagedGroupPlanEntry {
  groupId: string;
  /**
   * Position in the root's pre-order DFS — Square's `parent_category.ordinal` order. This is THE
   * sort key for the menu's assembly (see `computeAssemblyOrder`); nothing else orders a managed
   * menu.
   */
  sortIndex: number;
}

/** One desired managed Menu: the root it mirrors, plus its groups in ordinal order. */
interface ManagedMenuPlanEntry {
  rootCategoryId: string;
  rootCategoryName: string;
  /** The existing managed Menu doc, when this root already has one. */
  existingMenu?: DocData;
  groups: ManagedGroupPlanEntry[];
}

interface ReconciliationPlan {
  menus: ManagedMenuPlanEntry[];
  /** Managed groups that do not exist yet, already built as domain entities. */
  groupCreates: MenuGroup[];
  /** Managed MenuGroup doc ids to delete — their category is gone, or they lost a duplicate race. */
  groupDeletes: string[];
  /** Managed Menu doc ids to delete — their root is gone, or they lost a duplicate race. */
  menuDeletes: string[];
  /** Descendant categories whose parent chain never reaches a live root, for the skip warning. */
  unattachedCategoryIds: string[];
}

interface MenuAssembly {
  menuAssets: Record<string, MenuAsset>;
  groupDisplayOrder: string[];
  menuAssetDisplayOrder: string[];
}

/**
 * Winner selection among managed docs bound to the SAME mirror category. The lexicographically
 * lowest doc id wins, so the choice is deterministic across runs and independent of Firestore's
 * document ordering; every loser is deleted by the caller. Unlike #88's version this never has to
 * prefer an already-managed doc, because only managed docs are ever candidates — the mirror does
 * not adopt.
 *
 * Returns undefined for an empty candidate list, so "no doc mirrors this category yet" is a value
 * the callers narrow on rather than a length check they have to remember to write.
 */
function pickWinner(candidates: DocData[]): DocData | undefined {
  let winner: DocData | undefined;
  for (const candidate of candidates) {
    if (!winner || candidate.id < winner.id) winner = candidate;
  }
  return winner;
}

/** Reads a raw Firestore value as a non-empty string, or null. */
function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Reads a raw Firestore value as a finite number, or null. */
function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Reads the raw Category docs into tree nodes. Every field is defended against untyped Firestore
 * data (absent, wrong type, empty string) rather than trusted, because these docs are written by
 * square-gateway-claude and by pre-#173 code that did not know the fields existed.
 *
 * `rootCategoryId` is mirrored from Square and deliberately NOT read. It is a DENORMALIZATION of
 * the same parent chain this service walks, so trusting it would mean trusting two sources that
 * can disagree — and the chain is the one that has to be intact anyway, since a depth-3 category
 * needs its depth-2 ancestor to know where in the sequence it belongs. Walking the chain also
 * fails CLOSED (an incomplete tree yields "unattached") where `rootCategoryId` would attach a
 * category to a menu whose intermediate section was never read.
 */
function toCategoryNodes(categories: DocData[]): CategoryNode[] {
  return categories.map((category) => ({
    id: category.id,
    name: typeof category.data.name === 'string' ? category.data.name : '',
    parentCategoryId: asNonEmptyString(category.data.parentCategoryId),
    parentOrdinal: asFiniteNumber(category.data.parentOrdinal),
    isTopLevel: category.data.isTopLevel !== false,
  }));
}

/**
 * Sibling order WITHIN one parent: Square's `parent_category.ordinal` first, then the category
 * name, then the id.
 *
 * Ordinal-less siblings sort AFTER ordinaled ones (`null` is "unknown position", and Square omits
 * the ordinal only on data that never carried one) rather than being treated as ordinal 0, which
 * would silently jump them to the front.
 *
 * The name/id fallbacks are deliberately NOT `localeCompare`: its result depends on the runtime's
 * ICU data and default locale, so two Node builds (or a container with a trimmed ICU) would
 * produce different orders for the same input — which makes "deterministic and stable across
 * runs" false and produces pointless menu rewrites. Plain codepoint comparison is stable
 * everywhere.
 */
function compareSiblings(a: CategoryNode, b: CategoryNode): number {
  if (a.parentOrdinal !== b.parentOrdinal) {
    if (a.parentOrdinal === null) return 1;
    if (b.parentOrdinal === null) return -1;
    return a.parentOrdinal - b.parentOrdinal;
  }
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * #85 Amendment 1 — DEPTH > 2 IS FLATTENED, ORDER IS NOT.
 *
 * KIOS surfaces are two levels (Menu → MenuGroup) while Square nests arbitrarily, so every
 * descendant of a root — depth 2, depth 3, deeper — becomes a MenuGroup on that root's Menu. The
 * sequence is a PRE-ORDER DFS with siblings in `parentOrdinal` order, which places a depth-3
 * category immediately after the depth-2 ancestor it belongs to: "flattened into the nearest
 * depth-2 ancestor, preserving ordinal order".
 *
 * Each flattened descendant keeps its OWN group bound to its OWN category, so its products still
 * resolve through #79's `effectiveGroupProductIds`. The only thing lost is the nesting level —
 * never a descendant's contents, and never the authored order.
 *
 * THE ROOT ITSELF IS EXCLUDED, and that is a deliberate loss: a root becomes a `Menu`, a Menu has
 * no product list, so any item Square attached directly to a top-level MENU_CATEGORY surfaces
 * nowhere in the mirror. Square's own menu editor puts items in sections rather than on the menu
 * itself, so this is empty in practice; giving the root a self-group would be the alternative, at
 * the cost of a phantom group with the menu's own name in every mirrored menu.
 *
 * PRECONDITION: each `childrenByParentId` bucket is already sorted. This function only walks — the
 * ordinal order comes from the caller's sort, not from here.
 */
function orderedDescendants(rootId: string, childrenByParentId: Map<string, CategoryNode[]>): CategoryNode[] {
  const ordered: CategoryNode[] = [];
  const walk = (parentId: string): void => {
    for (const child of childrenByParentId.get(parentId) ?? []) {
      ordered.push(child);
      walk(child.id);
    }
  };
  walk(rootId);
  return ordered;
}

/**
 * Resolves the root each descendant hangs from, by walking `parentCategoryId` up through the live
 * menu-category graph.
 *
 * Returns null for an UNATTACHED descendant — one whose chain hits a category that is not a live
 * menu category, or a cycle. Such a category is skipped entirely and is never promoted to a Menu:
 * `isTopLevel: false` is Square's own statement that this object is not a menu, so minting a Menu
 * for it would invent a menu the merchant never authored.
 *
 * "Skipped" understates the consequence, and the caller's warning says so: an unattached category
 * is not a winner for anything, so an existing managed group of its own is DELETED by the orphan
 * rule below, and if the category is later re-attached its group is minted afresh under a new doc
 * id — it takes its ordinal slot on the mirrored menu again, but the doc IDENTITY is gone, so any
 * operator menu that listed the old id is left with a dangling reference. That is only ever
 * correct if "unattached" means the merchant really did destroy the parent. A read that is merely
 * INCOMPLETE (a partially-written catalog sync) looks identical from here, so the caller of this
 * service must not invoke it against a half-synced catalog.
 */
function resolveRootId(node: CategoryNode, nodesById: Map<string, CategoryNode>): string | null {
  const seen = new Set<string>([node.id]);
  let current = node;
  for (;;) {
    if (current.parentCategoryId === null) return null; // child with no parent link
    const parent = nodesById.get(current.parentCategoryId);
    if (!parent) return null; // parent missing, deleted, or not a menu category
    if (parent.isTopLevel) return parent.id;
    if (seen.has(parent.id)) return null; // cycle in hand-edited or corrupt data
    seen.add(parent.id);
    current = parent;
  }
}

/**
 * The whole diff, computed purely — no I/O, no Firestore types beyond the raw doc data. Keeping
 * this a pure function is what makes the reconciliation logic testable in isolation (the
 * `CatalogCascadeService` compute/apply split, applied here).
 *
 * @param categories non-deleted Categories with `categoryType === 'menu'`
 * @param groups every non-deleted MenuGroup in the business
 * @param menus every non-deleted Menu in the business
 */
function planReconciliation(
  categories: DocData[],
  groups: DocData[],
  menus: DocData[],
): ReconciliationPlan {
  const nodes = toCategoryNodes(categories);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  // Attach every descendant to its root, dropping the unattached. Children are collected per
  // parent (not per root) so the DFS below can recurse to any depth.
  const childrenByParentId = new Map<string, CategoryNode[]>();
  const unattachedCategoryIds: string[] = [];
  for (const node of nodes) {
    if (node.isTopLevel) continue;
    if (resolveRootId(node, nodesById) === null) {
      unattachedCategoryIds.push(node.id);
      continue;
    }
    // `parentCategoryId` is non-null here: `resolveRootId` returns null when it is null.
    const parentId = node.parentCategoryId as string;
    const bucket = childrenByParentId.get(parentId);
    if (bucket) bucket.push(node);
    else childrenByParentId.set(parentId, [node]);
  }
  for (const siblings of childrenByParentId.values()) siblings.sort(compareSiblings);

  // Index the MANAGED docs by the category they mirror. Operator-owned docs are deliberately never
  // indexed: with adoption gone, a doc this service did not create is a doc it must not touch, and
  // the only way to guarantee that is to keep it out of the candidate set entirely.
  const indexManagedByMirrorCategoryId = (docs: DocData[]): Map<string, DocData[]> => {
    const byCategoryId = new Map<string, DocData[]>();
    for (const doc of docs) {
      if (doc.data.managedBy !== MANAGED_BY) continue;
      const mirrorCategoryId = asNonEmptyString(doc.data.mirrorCategoryId);
      if (mirrorCategoryId === null) continue;
      const bucket = byCategoryId.get(mirrorCategoryId);
      if (bucket) bucket.push(doc);
      else byCategoryId.set(mirrorCategoryId, [doc]);
    }
    return byCategoryId;
  };
  const managedMenusByCategoryId = indexManagedByMirrorCategoryId(menus);
  const managedGroupsByCategoryId = indexManagedByMirrorCategoryId(groups);

  const plan: ReconciliationPlan = {
    menus: [],
    groupCreates: [],
    groupDeletes: [],
    menuDeletes: [],
    unattachedCategoryIds,
  };

  const keptMenuIds = new Set<string>();
  const keptGroupIds = new Set<string>();

  // Roots in a deterministic sequence, so `menus` in the return value is stable across runs.
  // `compareSiblings` is reused rather than a root-specific comparator, and that is load-bearing:
  // roots DO carry an ordinal. Square sends `parent_category` on a root with an ordinal but no
  // `id` (verified on the live KREATION ORGANIC catalog: root "Kafe 3rd Party Vendor Menu" has
  // `parent_category: { ordinal: -2242591403802624 }`, `is_top_level: true`, no `root_category`),
  // and square-gateway-claude#291 deliberately KEEPS that ordinal while mapping
  // parentCategoryId/rootCategoryId to null — it is the merchant's menu ordering and the only
  // signal for it.
  //
  // So roots sort by Square's ordinal, falling back to (name, id) only when `parentOrdinal` is
  // null — legacy docs written before #291 stamped the field. Do not "simplify" this to a
  // name-only sort on the assumption that roots are ordinal-less; they are not.
  //
  // Note this ordering currently reaches nothing but the returned array: KIOS has no per-business
  // menu ordering field, so Remy orders the menu list its own way. The fidelity is captured here
  // rather than surfaced.
  const roots = nodes.filter((node) => node.isTopLevel).sort(compareSiblings);

  for (const root of roots) {
    const existingMenu = pickWinner(managedMenusByCategoryId.get(root.id) ?? []);
    if (existingMenu) keptMenuIds.add(existingMenu.id);

    const groupEntries: ManagedGroupPlanEntry[] = [];
    orderedDescendants(root.id, childrenByParentId).forEach((child, sortIndex) => {
      const winner = pickWinner(managedGroupsByCategoryId.get(child.id) ?? []);
      if (winner) {
        keptGroupIds.add(winner.id);
        groupEntries.push({ groupId: winner.id, sortIndex });
        return;
      }
      // productDisplayOrder stays [] on purpose: a mirror group's effective product list lives
      // on the mirror CATEGORY and is resolved at materialization time by
      // `effectiveGroupProductIds()` (#79). Pre-filling it here would create a second, stale
      // copy of the truth that the two paths could drift apart on.
      const group = createMenuGroup({
        name: child.name,
        displayName: child.name,
        mirrorCategoryId: child.id,
        managedBy: MANAGED_BY,
      });
      plan.groupCreates.push(group);
      groupEntries.push({ groupId: group.Id, sortIndex });
    });

    plan.menus.push({
      rootCategoryId: root.id,
      rootCategoryName: root.name,
      existingMenu,
      groups: groupEntries,
    });
  }

  // THE SINGLE ORPHAN RULE, now a deletion rule:
  //   every live `managedBy: 'square'` doc that is not a winner for a live mirror category is
  //   DELETED. One sentence, no branches, and it subsumes every case:
  //     1. the mirror category document no longer exists;
  //     2. the mirror category was soft-deleted, or demoted to 'regular' / 'kitchen';
  //     3. a child category was reparented under a root that no longer exists (unattached);
  //     4. a legacy flat "Square Menu" carrying `managedBy: 'square'` with NO `mirrorCategoryId` —
  //        the combination #85 Amendment 1 calls nonsensical — is swept away by the same rule,
  //        because it can never be a winner;
  //     5. two managed docs mirror the same category: the loser is by definition not the winner.
  // Operator-owned docs are never candidates: `managedBy !== 'square'` fails the first test, so
  // this loop cannot reach anything the mirror did not create.
  for (const menu of menus) {
    if (menu.data.managedBy === MANAGED_BY && !keptMenuIds.has(menu.id)) plan.menuDeletes.push(menu.id);
  }
  for (const group of groups) {
    if (group.data.managedBy === MANAGED_BY && !keptGroupIds.has(group.id)) plan.groupDeletes.push(group.id);
  }

  return plan;
}

/**
 * #183: a managed Menu's asset order is a PURE PROJECTION of Square's `parent_category.ordinal`.
 * One input — `sortIndex` — and no others.
 *
 * The existing `menuAssetDisplayOrder` is deliberately NOT read, and that is the whole of #183.
 * #100 read it, so an operator's reorder in Remy would win over the mirror; but the value read is
 * written by the PREVIOUS SYNC every bit as often as by an operator, which made the desired state a
 * function of its own output. Its fixed point is therefore whatever the first run happened to
 * produce: a merchant who reorders their sections in Square keeps the old order in KIOS FOREVER,
 * with only newly-added groups appending at the end, and nothing reports the divergence. With
 * remy#471 removing the reorder control there is no operator intent left to protect, so the
 * destination doc is now read for identity and for the no-churn compare (`assemblyEquals`) only —
 * never as an input to the value.
 *
 * Purity is also what keeps `assemblyEquals` silent on a steady-state run: re-deriving from an
 * unchanged catalog yields an identical array, so the reuse path writes nothing.
 *
 * @param managedGroups the desired managed set for ONE menu, carrying its ordinal order
 */
function computeAssemblyOrder(managedGroups: ManagedGroupPlanEntry[]): string[] {
  // Keyed by groupId, so the desired set is de-duplicated BY CONSTRUCTION: emitting an id twice
  // would make the order LONGER than the `menuAssets` map `buildAssembly` derives from it, breaking
  // the "three identical sequences" invariant that `assemblyEquals` and Remy both depend on.
  const desiredByGroupId = new Map<string, ManagedGroupPlanEntry>();
  for (const entry of managedGroups) desiredByGroupId.set(entry.groupId, entry);

  // The caller already emits its entries in DFS order, so this sort changes nothing today. It stays
  // because it makes the function TOTAL ON ITS INPUT rather than resting on an undocumented caller
  // invariant, and it keeps `sortIndex` load-bearing: a later change to the DFS cannot silently
  // reorder a merchant's menu without a test going red.
  return [...desiredByGroupId.values()]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((entry) => entry.groupId);
}

/**
 * #88: the ONLY place a managed Menu's three membership/ordering fields are produced, so no
 * consumer can ever see a third answer.
 *
 * All three must be written, as identical sequences:
 * - `menuAssets` is what `attemptRebuild` derives membership from (`MenuRebuildService.ts:344`);
 * - `menuAssetDisplayOrder` is what Remy actually renders — `MenuGroupList.tsx:176` feeds the
 *   list with `menu.menuAssetDisplayOrder ?? []` and `:150` derives the count from it — and
 *   `rebuildMenus` only ever FILTERS that array, never derives it, so leaving it empty renders
 *   an empty menu;
 * - `groupDisplayOrder` is the legacy order, kept in sync for older readers.
 *
 * Consequence, and it is intended: the assembly is exactly the managed group set in exactly
 * Square's order, so any non-group asset (collection / product / htmlText) placed on a managed Menu
 * is dropped, and any stored order that disagrees with Square is overwritten. Managed Menus are
 * UI-locked per #85 as amended by #183 — read-only WITHOUT EXCEPTION, ordering included. So an
 * operator can neither add an asset nor reorder one, and a stray asset or a hand-written order can
 * only arrive from outside Remy.
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
 * #88: no-churn guard for the reuse path — a menu doc is only updated when its assembly actually
 * differs, so a steady-state run writes nothing.
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
 * One mirrored Menu as reported back to the caller.
 *
 * `mirrorCategoryId` is the id of the root menu-category this Menu mirrors — the exact value
 * written to `Menu.mirrorCategoryId`, so a caller can correlate the response to the doc field
 * without a read. It is deliberately NOT named `rootCategoryId`: `Category.rootCategoryId` is
 * Square's `root_category` ancestor pointer, which means something different and is null on
 * precisely the roots reported here.
 */
export interface ManagedMenuResult {
  menuId: string;
  mirrorCategoryId: string;
  managedGroupIds: string[];
}

/**
 * Mirrors the business's Square menu tree — one managed `Menu` per root `categoryType: 'menu'`
 * Category, one managed `MenuGroup` per descendant — and materializes the result.
 *
 * Idempotent: a run that finds the desired state already in place performs zero document writes
 * (the trailing `rebuildMenus` rewrites each menu byte-identically).
 *
 * @param businessId the tenant to mirror
 * @returns one entry per managed Menu, ordered by root category (name, id); each carries the root
 *   it mirrors and its managed MenuGroup ids **in Square's `parent_category.ordinal` order** — the
 *   same array as that menu's stored `menuAssetDisplayOrder`, so a caller can log or assert the
 *   order without re-reading Firestore
 */
export async function syncManagedSquareMenu(
  businessId: string,
): Promise<{ menus: ManagedMenuResult[] }> {
  // The `updated` stamp for the one narrow update() this service issues (a menu whose assembly
  // changed). Created docs get their own stamp from `baseEntityDefaults`, and deletes carry none,
  // so this is no longer a whole-run timestamp — it is hoisted only to keep it out of the loop.
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
    // FULL collection reads on purpose. A `where('mirrorCategoryId', 'in', …)` query (the
    // gateway's approach) would need 30-id chunking AND would miss orphaned managed docs whose
    // category no longer exists — precisely the set the deletion rule has to find. The menus read
    // is unfiltered for the same reason: a legacy managed Menu with no `mirrorCategoryId` has to
    // be visible in order to be swept. These collections are tens of docs, so the full reads are
    // both simpler and strictly more correct.
    PathResolver.menuGroupsCollection(businessId).get(),
    PathResolver.menusCollection(businessId).get(),
  ]);

  // `isDeleted` is filtered IN MEMORY (by `toLiveDocs`), deliberately not as a second `where()`:
  // combining it with the equality clause above would require a composite index, and until that
  // index is built Firestore returns an empty result set — the reconciler would silently see no
  // categories and delete every managed doc. In-memory filtering has no such failure mode.
  const categories = toLiveDocs(categorySnap);
  const groups = toLiveDocs(groupSnap);
  const menus = toLiveDocs(menuSnap);

  // ---------------------------------------------------------------------------
  // Phase B — plan (pure).
  // ---------------------------------------------------------------------------
  const plan = planReconciliation(categories, groups, menus);

  // Emitted on EVERY run that sees one, not only on runs that changed something. A category
  // stranded from its root is a data problem that does not fix itself, and it silently costs the
  // merchant a section of their menu, so the repetition is the point — a one-shot line would be
  // gone from the logs long before anyone went looking.
  if (plan.unattachedCategoryIds.length > 0) {
    console.warn('[ManagedMenuService] menu categories with no live root: not mirrored, any managed group deleted', {
      businessId,
      categoryIds: plan.unattachedCategoryIds,
    });
  }

  // ---------------------------------------------------------------------------
  // Phase C — apply the group writes, BEFORE the menu assemblies.
  // ---------------------------------------------------------------------------
  // Ordering rationale: a menu must never reference a MenuGroup doc that does not exist yet. A
  // dangling ref is pruned by `pruneDanglingAssetRefs` on the very next rebuild, so the group
  // would flap in and out of the menu on alternating runs. Writing groups first makes every crash
  // point re-runnable instead: an extra un-referenced managed group is re-used (or deleted) next
  // run, and a deleted-but-still-listed group is dropped from the assembly next run.
  //
  // Sequential awaits, no `db.batch()` / `BulkWriter`: there is no precedent for either anywhere
  // in `src/`, and `rebuildMenus` opens its own transactions immediately afterwards, so
  // end-to-end atomicity is unreachable regardless of how these writes are grouped.
  const groupsRef = PathResolver.menuGroupsCollection(businessId);
  for (const group of plan.groupCreates) {
    await groupsRef.doc(group.Id).set(menuGroupConverter.toFirestore(group));
  }

  // ---------------------------------------------------------------------------
  // Phase D — resolve-or-create each Menu and write its assembly.
  // ---------------------------------------------------------------------------
  const menusRef = PathResolver.menusCollection(businessId);
  const results: ManagedMenuResult[] = [];
  let changedMenuCount = 0;

  for (const menuPlan of plan.menus) {
    const order = computeAssemblyOrder(menuPlan.groups);
    const assembly = buildAssembly(order);

    let menuId: string;
    if (!menuPlan.existingMenu) {
      // `Menu.groups` is deliberately NOT written here — `createMenu` leaves it `{}` and the
      // update path never touches it. `rebuildMenus` overwrites `groups` wholesale from the
      // freshly-read MenuGroup/Category/Product docs (`MenuRebuildService.ts:443`), so anything
      // written here would be dead work — and worse, would make this service a SECOND writer of a
      // materialized projection, which is exactly the drift hazard #79 warns about. `{}` is
      // self-consistent ("not yet materialized") and Phase F runs unconditionally below.
      //
      // The Menu is NAMED AFTER ITS ROOT CATEGORY at creation and never renamed afterwards, the
      // same rule managed groups have followed since #88: name drift is out of scope, and a
      // rename would be a write on a doc whose assembly is otherwise unchanged.
      const menu = createMenu({
        name: menuPlan.rootCategoryName,
        displayName: menuPlan.rootCategoryName,
        mirrorCategoryId: menuPlan.rootCategoryId,
        managedBy: MANAGED_BY,
        ...assembly,
      });
      await menusRef.doc(menu.Id).set(menuConverter.toFirestore(menu));
      menuId = menu.Id;
      changedMenuCount += 1;
    } else {
      menuId = menuPlan.existingMenu.id;
      if (!assemblyEquals(menuPlan.existingMenu.data, assembly)) {
        await menusRef.doc(menuId).update({ ...assembly, updated: nowIso });
        changedMenuCount += 1;
      }
    }

    results.push({ menuId, mirrorCategoryId: menuPlan.rootCategoryId, managedGroupIds: order });
  }

  // ---------------------------------------------------------------------------
  // Phase E — apply the deletions, AFTER every surviving doc has been written.
  // ---------------------------------------------------------------------------
  // Deletions come last, and that ordering is the whole re-runnability argument: at every crash
  // point the tree is a SUPERSET of the desired state, never a subset. Crash mid-deletion and the
  // leftovers are simply deleted again next run; delete first and a crash could leave a live Menu
  // pointing at a group that no longer exists.
  //
  // HARD deletes, matching `FirestoreRepository.delete()`'s own semantics. A soft delete would
  // leave the doc readable by anything that does not filter `isDeleted`, and would NOT make an
  // operator's reference dangle, so `pruneDanglingAssetRefs` would never clean it up. Caveat worth
  // knowing: that pruning is itself gated on `pruneMenuAssetsOnRebuild` (#132). With the flag off,
  // an operator menu that listed a deleted group keeps the dead id until the flag is enabled —
  // the reference is inert either way, because the group doc is gone.
  for (const id of plan.groupDeletes) {
    await groupsRef.doc(id).delete();
  }
  for (const id of plan.menuDeletes) {
    await menusRef.doc(id).delete();
  }

  // Log only when something actually happened. This runs on every catalog sync, so a per-run line
  // on the no-change path would drown the signal — same reasoning as `MenuRebuildService.ts:457`,
  // which warns only when it actually pruned something.
  if (
    plan.groupCreates.length > 0
    || plan.groupDeletes.length > 0
    || plan.menuDeletes.length > 0
    || changedMenuCount > 0
  ) {
    // Deletions carry their IDS, not just a count. Everything else this run does is re-derivable
    // from the catalog on the next run, so a count is enough; a hard delete is not — this line is
    // the only record that the doc ever existed, and an incident review that can only see
    // "groupsDeleted: 41" has nothing to work with.
    console.warn('[ManagedMenuService] mirrored Square menus', {
      businessId,
      menuCount: results.length,
      menusChanged: changedMenuCount,
      menusDeleted: plan.menuDeletes,
      groupsCreated: plan.groupCreates.length,
      groupsDeleted: plan.groupDeletes,
    });
  }

  // ---------------------------------------------------------------------------
  // Phase E — materialize, unconditionally.
  // ---------------------------------------------------------------------------
  // Unconditional by design. The managed group SET can be unchanged while a mirror category's
  // `productDisplayOrder` changed, and materialization is an acceptance criterion — skipping the
  // rebuild "for idempotency" would be an anti-optimisation that leaves menus stale.
  // `rebuildMenus` rewrites a menu byte-identically on a no-change run, so this costs no churn. It
  // also cannot be a silent no-op here: `rebuildMenus` bulk-reads all menus and filters the scoped
  // ids against that read (`MenuRebuildService.ts:134`), and by this point every mirrored Menu doc
  // is guaranteed to exist — which is precisely why Phase D comes first.
  //
  // `changedMenuGroupIds` carries the groups deleted above so that an OPERATOR's own menu that had
  // one of them as an asset is rebuilt too, and `pruneDanglingAssetRefs` drops the dead reference
  // in the same run rather than leaving it until that menu happens to change.
  await rebuildMenus(businessId, {
    menuIds: results.map((r) => r.menuId),
    changedMenuGroupIds: plan.groupDeletes,
  });

  return { menus: results };
}
