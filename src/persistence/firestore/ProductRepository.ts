import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Product } from '../../domain/catalog/Product';
import Catalog from '../../restaurant/roots/Catalog';
import * as Paths from '../../firestore-core/Paths';
import { locationInventoryToFirestore, locationInventoryFromFirestore }
  from './helpers/InventoryCountConverter';

export class ProductRepository extends FirestoreRepository<Product> {
  protected config(): FirestoreRepositoryConfig<Product> {
    return {
      collectionRef(businessId: string) {
        return Catalog.docRef(businessId).collection(Paths.CollectionNames.products);
      },
      toFirestore(product: Product): FirebaseFirestore.DocumentData {
        return {
          name: product.name,
          caption: product.caption,
          description: product.description,
          imageUrls: product.imageUrls,
          imageGsls: product.imageGsls,
          optionSets: JSON.parse(JSON.stringify(product.optionSets)),
          optionSetsSelection: JSON.parse(JSON.stringify(product.optionSetsSelection)),
          minPrice: product.minPrice,
          maxPrice: product.maxPrice,
          variationCount: product.variationCount,
          locationInventory: locationInventoryToFirestore(product.locationInventory),
          isActive: product.isActive,
          linkedObjects: JSON.parse(JSON.stringify(product.linkedObjects)),
          created: product.created.toISOString(),
          updated: product.updated.toISOString(),
          isDeleted: product.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Product {
        return new Product({
          Id: id,
          name: data.name,
          caption: data.caption ?? '',
          description: data.description ?? '',
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          optionSets: data.optionSets ?? {},
          optionSetsSelection: data.optionSetsSelection ?? {},
          minPrice: data.minPrice,
          maxPrice: data.maxPrice,
          variationCount: data.variationCount,
          locationInventory: locationInventoryFromFirestore(data.locationInventory),
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
