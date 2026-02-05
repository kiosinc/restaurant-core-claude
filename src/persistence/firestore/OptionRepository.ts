import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Option } from '../../domain/catalog/Option';
import { PathResolver } from './PathResolver';
import { locationInventoryToFirestore, locationInventoryFromFirestore }
  from './helpers/InventoryCountConverter';

export class OptionRepository extends FirestoreRepository<Option> {
  protected config(): FirestoreRepositoryConfig<Option> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.optionsCollection(businessId);
      },
      toFirestore(option: Option): FirebaseFirestore.DocumentData {
        return {
          name: option.name,
          price: option.price,
          sku: option.sku,
          gtin: option.gtin,
          imageUrls: option.imageUrls,
          imageGsls: option.imageGsls,
          locationPrices: JSON.parse(JSON.stringify(option.locationPrices)),
          locationInventory: locationInventoryToFirestore(option.locationInventory),
          isActive: option.isActive,
          linkedObjects: JSON.parse(JSON.stringify(option.linkedObjects)),
          created: option.created.toISOString(),
          updated: option.updated.toISOString(),
          isDeleted: option.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Option {
        return new Option({
          Id: id,
          name: data.name,
          price: data.price,
          sku: data.sku ?? null,
          gtin: data.gtin ?? null,
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
          locationPrices: data.locationPrices ?? {},
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
