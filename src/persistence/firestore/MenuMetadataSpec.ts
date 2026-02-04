import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';
import { Menu } from '../../domain/surfaces/Menu';
import { MenuMeta } from '../../domain/surfaces/MenuMeta';
import Surfaces from '../../restaurant/roots/Surfaces';
import * as Paths from '../../firestore-core/Paths';

export class MenuMetadataSpec implements MetadataSpec<Menu, MenuMeta> {
  getMetadata(entity: Menu): MenuMeta {
    return entity.metadata();
  }

  getMetaLinks(entity: Menu, businessId: string): MetaLinkDeclaration[] {
    return [{
      documentPath: Surfaces.docRef(businessId).path,
      fieldPath: `${Paths.CollectionNames.menus}.${entity.Id}`,
    }];
  }
}
