import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Discount, DiscountType } from '../../domain/catalog/Discount';
import Catalog from '../../restaurant/roots/Catalog';
import * as Paths from '../../firestore-core/Paths';

export class DiscountRepository extends FirestoreRepository<Discount> {
  protected config(): FirestoreRepositoryConfig<Discount> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.discounts);
      },
      toFirestore(discount: Discount): FirebaseFirestore.DocumentData {
        return {
          name: discount.name,
          description: discount.description,
          couponCode: discount.couponCode,
          type: discount.type,
          value: discount.value,
          isActive: discount.isActive,
          linkedObjects: JSON.parse(JSON.stringify(discount.linkedObjects)),
          created: discount.created.toISOString(),
          updated: discount.updated.toISOString(),
          isDeleted: discount.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Discount {
        return new Discount({
          Id: id,
          name: data.name,
          description: data.description ?? '',
          couponCode: data.couponCode ?? '',
          type: data.type as DiscountType,
          value: data.value,
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
