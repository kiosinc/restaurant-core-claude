export {
  ParentUpdate,
  productSpec,
  optionSetSpec,
  optionSpec,
  buildSavedUpdates,
  buildDeletedUpdates,
} from './CatalogCascadeService';

export {
  CascadeGraphRegistry,
  CascadeNode,
  CascadeEdge,
  CascadeTier,
  createDefaultCascadeGraph,
} from './CascadeGraphRegistry';

export {
  WriteModelFlags,
  createFlagService,
  getFlags,
  clearFlagCache,
} from './FeatureFlagService';

export {
  RebuildScope,
  RebuildOptions,
  rebuildMenus,
  resolveChangedProducts,
  resolveChangedCategories,
} from './MenuRebuildService';

export {
  ProductAvailability,
  OptionAvailability,
  AvailabilityDoc,
  getAvailability,
  setProductAvailability,
  setOptionAvailability,
  setProductAvailabilityBatch,
  updateAvailability,
  getOptionTimestamp,
  removeOptionAvailability,
  removeProductAvailability,
  deleteAvailabilityDoc,
} from './AvailabilityService';

export {
  ManagedMenuResult,
  syncManagedSquareMenu,
} from './ManagedMenuService';

// #207: the rebuild-relevant read-sets, exported so a cascade caller gates on this repo's
// contract instead of re-deriving it from ProductMeta/MenuProductMeta/MenuGroupMeta by hand.
export {
  RebuildKind,
  RebuildDocData,
  ProductRebuildField,
  MenuGroupRebuildField,
  PRODUCT_REBUILD_FIELDS,
  MENU_GROUP_REBUILD_FIELDS,
  REBUILD_FIELDS,
  affectsRebuild,
  affectsProductRebuild,
  affectsMenuGroupRebuild,
} from './RebuildRelevance';
