import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { MenuGroup } from '../../domain/surfaces/MenuGroup';
import Surfaces from '../../restaurant/roots/Surfaces';
import * as Paths from '../../firestore-core/Paths';

export class MenuGroupRepository extends FirestoreRepository<MenuGroup> {
  protected config(): FirestoreRepositoryConfig<MenuGroup> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection(Paths.CollectionNames.menuGroups);
      },
      toFirestore(mg: MenuGroup): FirebaseFirestore.DocumentData {
        return {
          name: mg.name,
          products: JSON.parse(JSON.stringify(mg.products)),
          productDisplayOrder: JSON.parse(JSON.stringify(mg.productDisplayOrder)),
          displayName: mg.displayName ?? null,
          parentGroup: mg.parentGroup ?? null,
          childGroup: mg.childGroup ?? null,
          mirrorCategoryId: mg.mirrorCategoryId ?? null,
          created: mg.created.toISOString(),
          updated: mg.updated.toISOString(),
          isDeleted: mg.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): MenuGroup {
        return new MenuGroup({
          Id: id,
          name: data.name,
          displayName: data.displayName ?? null,
          products: data.products ?? {},
          productDisplayOrder: data.productDisplayOrder ?? [],
          parentGroup: data.parentGroup ?? null,
          childGroup: data.childGroup ?? null,
          mirrorCategoryId: data.mirrorCategoryId ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
