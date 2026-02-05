import { FieldValue } from 'firebase-admin/firestore';
import { RelationshipHandler } from './RelationshipHandler';
import { Option } from '../../../domain/catalog/Option';
import { PathResolver } from '../PathResolver';

/**
 * When an Option is saved: update OptionMeta in all OptionSets that contain it.
 * When an Option is deleted: remove from OptionSet options map, optionDisplayOrder,
 * and preselectedOptionIds.
 *
 * Replaces the Option instanceof branch in FirestoreWriter.setT()/deleteT().
 */
export class OptionRelationshipHandler implements RelationshipHandler<Option> {
  async onSet(option: Option, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const optionSetRef = PathResolver.optionSetsCollection(businessId);
    const snapshot = await t.get(
      optionSetRef.where(`options.${option.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`options.${option.Id}`]: option.metadata() });
    }
  }

  async onDelete(option: Option, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const optionSetRef = PathResolver.optionSetsCollection(businessId);
    const snapshot = await t.get(
      optionSetRef.where(`options.${option.Id}.name`, '>=', ''),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`options.${option.Id}`]: FieldValue.delete(),
        optionDisplayOrder: FieldValue.arrayRemove(option.Id),
        preselectedOptionIds: FieldValue.arrayRemove(option.Id),
      });
    }
  }
}
