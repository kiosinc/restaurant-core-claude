/**
 * Constructs a Firestore query to find entities by their linked external object ID.
 * Replaces LinkedObject.findQuery().
 */
export function linkedObjectQuery(
  linkedObjectId: string,
  provider: string,
  collectionRef: FirebaseFirestore.CollectionReference,
  converter?: FirebaseFirestore.FirestoreDataConverter<any>,
): FirebaseFirestore.Query<any> {
  let query = collectionRef
    .where(`linkedObjects.${provider}.linkedObjectId`, '==', linkedObjectId);

  if (converter) {
    query = query.withConverter(converter);
  }

  return query;
}

/**
 * Finds a single entity by its linked external object ID.
 * Returns the entity data if exactly one match, null if none, throws if multiple.
 * Replaces LinkedObject.find().
 */
export async function findByLinkedObjectId(
  linkedObjectId: string,
  provider: string,
  collectionRef: FirebaseFirestore.CollectionReference,
  converter: FirebaseFirestore.FirestoreDataConverter<unknown>,
): Promise<unknown | null> {
  const snapshot = await linkedObjectQuery(
    linkedObjectId,
    provider,
    collectionRef,
    converter,
  ).get();

  if (snapshot.empty) {
    return null;
  }
  if (snapshot.docs.length > 1) {
    throw new Error(
      `There is more than one ${collectionRef.path} Collection object `
      + `${snapshot.docs.map((t) => t.id)} with the same linkedID ${linkedObjectId}`,
    );
  }
  return snapshot.docs[0].data();
}
