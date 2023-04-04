/**
 * LinkedObject class
 */
import * as Constants from '../Constants';

/**
 * LinkedObject represents a direct relationship to another object
 * that exists on an external system
 */
export default class LinkedObject {
  linkedObjectId: string;

  /** Is syncing active on this object */
  // isSync: boolean;

  constructor(
    linkedObjectId: string,
    // isSync: boolean,
  ) {
    this.linkedObjectId = linkedObjectId;
  }

  /**
   * Finds the object, if any, in the specified collection that is 'linked'
   * to the specified object (i.e. ID key matches).  Return false if not found.
   */
  static async find(
    linkedObjectId: string,
    provider: Constants.Provider,
    fromCollectionRef: FirebaseFirestore.CollectionReference,
    withConverter: FirebaseFirestore.FirestoreDataConverter<unknown>,
  ): Promise<unknown> {
    const snapshot = await this.findQuery(
      linkedObjectId,
      provider,
      fromCollectionRef,
      withConverter,
    ).get();

    if (snapshot.empty) {
      return false;
    } if (snapshot.docs.length > 1) {
      throw new Error(`There is more than one ${fromCollectionRef.path} Collection object ${snapshot.docs.map((t) => t.id)} with the same linkedID ${linkedObjectId}`);
    }
    return snapshot.docs[0].data();
  }

  /**
   * Constructs a Firestore query to find a converted object given the
   * 'linked' object ID
   */
  static findQuery(
    linkedObjectId: string,
    provider: Constants.Provider,
    fromCollectionRef: FirebaseFirestore.CollectionReference,
    withConverter: FirebaseFirestore.FirestoreDataConverter<unknown>,
  ): FirebaseFirestore.Query<unknown> {
    return fromCollectionRef
      .where(`linkedObjects.${provider}.linkedObjectId`, '==', linkedObjectId)
      .withConverter(withConverter);
  }
}
