import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Category } from '../../domain/catalog/Category';
import { PathResolver } from './PathResolver';

export class CategoryRepository extends FirestoreRepository<Category> {
  protected config(): FirestoreRepositoryConfig<Category> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.categoriesCollection(businessId);
      },
      toFirestore(category: Category): FirebaseFirestore.DocumentData {
        return {
          name: category.name,
          products: JSON.parse(JSON.stringify(category.products)),
          productDisplayOrder: category.productDisplayOrder,
          imageUrls: category.imageUrls,
          imageGsls: category.imageGsls,
          linkedObjects: JSON.parse(JSON.stringify(category.linkedObjects)),
          created: category.created.toISOString(),
          updated: category.updated.toISOString(),
          isDeleted: category.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Category {
        return new Category({
          Id: id,
          name: data.name,
          products: data.products ?? {},
          productDisplayOrder: data.productDisplayOrder ?? [],
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          linkedObjects: data.linkedObjects ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
