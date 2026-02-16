import { createMetadataSpec } from '../../domain/MetadataSpec';
import { Menu, MenuMeta, menuMeta } from '../../domain/surfaces/Menu';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

export const menuMetadataSpec = createMetadataSpec<Menu, MenuMeta>(
  menuMeta,
  (entity, businessId) => [{
    documentPath: PathResolver.surfacesDoc(businessId).path,
    fieldPath: `${Paths.CollectionNames.menus}.${entity.Id}`,
  }],
);
