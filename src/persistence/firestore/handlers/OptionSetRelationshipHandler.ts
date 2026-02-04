import { FieldValue } from 'firebase-admin/firestore';
import { RelationshipHandler } from './RelationshipHandler';
import { OptionSet } from '../../../domain/catalog/OptionSet';
import Catalog from '../../../restaurant/roots/Catalog';
import { CollectionNames } from '../../../firestore-core/Paths';

/**
 * When an OptionSet is saved: update OptionSetMeta in all Products that contain it.
 * When an OptionSet is deleted: remove from Product optionSets and optionSetsSelection.
 */
export class OptionSetRelationshipHandler implements RelationshipHandler<OptionSet> {
  async onSet(optionSet: OptionSet, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const productRef = Catalog.docRef(businessId).collection(CollectionNames.products);
    const snapshot = await t.get(
      productRef.where(`optionSets.${optionSet.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`optionSets.${optionSet.Id}`]: optionSet.metadata() });
    }
  }

  async onDelete(optionSet: OptionSet, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const productRef = Catalog.docRef(businessId).collection(CollectionNames.products);
    const snapshot = await t.get(
      productRef.where(`optionSets.${optionSet.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`optionSets.${optionSet.Id}`]: FieldValue.delete(),
        [`optionSetsSelection.${optionSet.Id}`]: FieldValue.delete(),
      });
    }
  }
}
