import { MetadataSpec, MetaLinkDeclaration } from '../../domain/MetadataSpec';
import { MenuGroup } from '../../domain/surfaces/MenuGroup';
import { MenuGroupMeta } from '../../domain/surfaces/MenuGroupMeta';
import { PathResolver } from './PathResolver';
import * as Paths from '../../firestore-core/Paths';

export class MenuGroupMetadataSpec implements MetadataSpec<MenuGroup, MenuGroupMeta> {
  getMetadata(entity: MenuGroup): MenuGroupMeta {
    return entity.metadata();
  }

  getMetaLinks(entity: MenuGroup, businessId: string): MetaLinkDeclaration[] {
    return [{
      documentPath: PathResolver.surfacesDoc(businessId).path,
      fieldPath: `${Paths.CollectionNames.menuGroups}.${entity.Id}`,
    }];
  }
}
