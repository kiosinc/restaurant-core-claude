import { MenuGroup, MenuGroupMeta, menuGroupMeta } from '../../domain/surfaces/MenuGroup';
import { PathResolver } from './PathResolver';
import { CollectionNames } from '../../firestore-core/Paths';
import { createRootMetadataSpec } from './createRootMetadataSpec';

export const menuGroupMetadataSpec = createRootMetadataSpec<MenuGroup, MenuGroupMeta>(
  menuGroupMeta,
  (businessId) => PathResolver.surfacesDoc(businessId),
  CollectionNames.menuGroups,
);
