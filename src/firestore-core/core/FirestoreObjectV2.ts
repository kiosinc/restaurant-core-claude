/**
 * FirestoreObject base class for objects that live on firestore
 */
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import LinkedObject from './LinkedObject'
import { Provider } from '../Constants'

export interface FirestoreObjectPropsV2 {
  businessId: string,
  Id?: string,
  created?: Date,
  updated?: Date,
  isDeleted?: boolean
}

function dateify(object: any) {
  Object.entries(object).forEach(([key, value]) => {
    if (typeof value !== 'object' || value === null) return;
    if (value instanceof Timestamp) {
      object[key] = value.toDate();
      return;
    }
    object[key] = dateify(value);
  });
  return object
}

/**
 * FirestoreObject base class for objects that live on firestore
 * Contains base properties each firestore object will write/read
 * onto/from the store i.e. unique ID key
 */
export abstract class FirestoreObjectV2 implements FirestoreObjectPropsV2 {
  businessId: string;

  // Firebase Document ID
  readonly Id: string
  readonly created: Date
  updated: Date
  readonly isDeleted: boolean

  /**
   * Create FirestoreObject
   * Intended to be called within a subclasses own constructor
   */
  protected constructor (props: FirestoreObjectPropsV2) {
    const now = new Date()

    this.businessId = props.businessId
    this.created = props.created ?? now
    this.updated = props.updated ?? now
    this.Id = props.Id ?? FirestoreObjectV2.autoId()
    this.isDeleted = props.isDeleted ?? false
  }

  async setGeneric (documentReference: FirebaseFirestore.DocumentReference,
                    metaLinks: {[p: string]: string},
                    metadata: any
                    ) {

    getFirestore().runTransaction(async (t) => {
      this.updated = new Date()
      t.set(
        documentReference.withConverter(FirestoreObjectV2.firestoreConverter),
        this
      )

      Object.keys(metaLinks).forEach((key) => {
        const value = metaLinks[key] as string;
        const docRef = getFirestore().doc(key);

        const fields = {
          [value]: metadata,
        };

        t.update(docRef, fields);
      });
    })
  }

  async updateGeneric (documentReference: FirebaseFirestore.DocumentReference) {
    this.updated = new Date()
    const data = FirestoreObjectV2.firestoreConverter.toFirestore(this)
    return documentReference
      .withConverter(FirestoreObjectV2.firestoreConverter)
      .update(data)
  }
  /**
   * Auto generate an unique ID using Firebase generation
   */
  static autoId (): string {
    return getFirestore().collection('_default').doc().id
  }

  static firestoreConverter: FirebaseFirestore.FirestoreDataConverter<any> = {
    toFirestore<T extends FirestoreObjectV2>(object: T): FirebaseFirestore.DocumentData {
      // Extract Id
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Id, businessId, ...data } = object
      return data
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
      const data = snapshot.data()
      data.Id = snapshot.id

      dateify(data)

      return data
    },
  }

  static async getGeneric<T extends FirestoreObjectV2>(
    businessId: string,
    documentReference: FirebaseFirestore.DocumentReference,
    object: { new (...args: any[]): T }) {

    const request = await documentReference
      .withConverter(FirestoreObjectV2.firestoreConverter)
      .get()

    if (!request.exists) {
      return null
    }

    const props = request.data()
    props.businessId = businessId
    props.Id = request.id

    return new object(props)
  }

  static async findGeneric<T extends FirestoreObjectV2>(
    linkedObjectId: string,
    provider: Provider,
    businessId: string,
    fromCollectionRef: FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData>,
    object: { new (...args: any[]): T }
  ) {

    const snapshot = await LinkedObject.findQuery(
      linkedObjectId,
      provider,
      fromCollectionRef
    ).get()

    if (snapshot.empty) {
      return null;
    } if (snapshot.docs.length > 1) {
      throw new Error(`${businessId} There is more than one document in ${fromCollectionRef.path} with the same linkedID ${linkedObjectId}: ${snapshot.docs.map((t) => t.id)}`);
    }

    const doc = snapshot.docs[0]
    const props = doc.data()
    props.businessId = businessId
    props.Id = doc.id

    return new object(props)
  }

  static deleteGeneric(documentReference: FirebaseFirestore.DocumentReference,
                metaLinks: {[p: string]: string}) {
    getFirestore().runTransaction(async (t) => {
      t.delete(documentReference)

      Object.keys(metaLinks).forEach((key) => {
        const value = metaLinks[key] as string;
        const docRef = getFirestore().doc(key);

        const fields = { [value]: FieldValue.delete() };
        t.update(docRef, fields);
      });
    });
  }
}
