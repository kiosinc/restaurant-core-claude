import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Menu } from '../../domain/surfaces/Menu';
import Surfaces from '../../restaurant/roots/Surfaces';
import * as Paths from '../../firestore-core/Paths';

export class MenuRepository extends FirestoreRepository<Menu> {
  protected config(): FirestoreRepositoryConfig<Menu> {
    return {
      collectionRef(businessId: string) {
        return Surfaces.docRef(businessId).collection(Paths.CollectionNames.menus);
      },
      toFirestore(menu: Menu): FirebaseFirestore.DocumentData {
        return {
          name: menu.name,
          displayName: menu.displayName,
          groups: JSON.parse(JSON.stringify(menu.groups)),
          groupDisplayOrder: JSON.parse(JSON.stringify(menu.groupDisplayOrder)),
          coverImageGsl: menu.coverImageGsl,
          coverBackgroundImageGsl: menu.coverBackgroundImageGsl,
          coverVideoGsl: menu.coverVideoGsl,
          logoImageGsl: menu.logoImageGsl,
          gratuityRates: JSON.parse(JSON.stringify(menu.gratuityRates)),
          created: menu.created.toISOString(),
          updated: menu.updated.toISOString(),
          isDeleted: menu.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Menu {
        return new Menu({
          Id: id,
          name: data.name,
          displayName: data.displayName ?? null,
          groups: data.groups ?? {},
          groupDisplayOrder: data.groupDisplayOrder ?? [],
          coverImageGsl: data.coverImageGsl ?? null,
          coverBackgroundImageGsl: data.coverBackgroundImageGsl ?? null,
          coverVideoGsl: data.coverVideoGsl ?? null,
          logoImageGsl: data.logoImageGsl ?? null,
          gratuityRates: data.gratuityRates ?? [],
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
