import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { OptionSet } from '../../domain/catalog/OptionSet';
import { PathResolver } from './PathResolver';
import { locationInventoryToFirestore, locationInventoryFromFirestore }
  from './helpers/InventoryCountConverter';

export class OptionSetRepository extends FirestoreRepository<OptionSet> {
  protected config(): FirestoreRepositoryConfig<OptionSet> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.optionSetsCollection(businessId);
      },
      toFirestore(os: OptionSet): FirebaseFirestore.DocumentData {
        return {
          name: os.name,
          options: JSON.parse(JSON.stringify(os.options)),
          minSelection: os.minSelection,
          maxSelection: os.maxSelection,
          displayOrder: os.displayOrder,
          displayTier: os.displayTier,
          optionDisplayOrder: os.optionDisplayOrder,
          preselectedOptionIds: os.preselectedOptionIds,
          imageUrls: os.imageUrls,
          imageGsls: os.imageGsls,
          locationInventory: locationInventoryToFirestore(os.locationInventory),
          isActive: os.isActive,
          linkedObjects: JSON.parse(JSON.stringify(os.linkedObjects)),
          created: os.created.toISOString(),
          updated: os.updated.toISOString(),
          isDeleted: os.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): OptionSet {
        return new OptionSet({
          Id: id,
          name: data.name,
          options: data.options ?? {},
          minSelection: data.minSelection,
          maxSelection: data.maxSelection,
          displayOrder: data.displayOrder,
          displayTier: data.displayTier,
          optionDisplayOrder: data.optionDisplayOrder ?? [],
          preselectedOptionIds: data.preselectedOptionIds ?? [],
          imageUrls: data.imageUrls ?? [],
          imageGsls: data.imageGsls ?? [],
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
