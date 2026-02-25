import { Menu, MenuMeta, menuMeta } from '../../domain/surfaces/Menu';
import { PathResolver } from './PathResolver';
import { CollectionNames } from '../../firestore-core/Paths';
import { createRootMetadataSpec } from './createRootMetadataSpec';

export const menuMetadataSpec = createRootMetadataSpec<Menu, MenuMeta>(
  menuMeta,
  (businessId) => PathResolver.surfacesDoc(businessId),
  CollectionNames.menus,
);
