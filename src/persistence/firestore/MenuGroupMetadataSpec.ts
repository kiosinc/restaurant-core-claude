import { createMetadataSpec } from '../../domain/MetadataSpec';
import { MenuGroup, MenuGroupMeta, menuGroupMeta } from '../../domain/surfaces/MenuGroup';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

export const menuGroupMetadataSpec = createMetadataSpec<MenuGroup, MenuGroupMeta>(
  menuGroupMeta,
  (entity, businessId) => [{
    documentPath: PathResolver.surfacesDoc(businessId).path,
    fieldPath: `${Paths.CollectionNames.menuGroups}.${entity.Id}`,
  }],
);
