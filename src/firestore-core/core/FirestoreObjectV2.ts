/**
 * FirestoreObject base class for objects that live on firestore
 */
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

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
    fromFirestore<T extends FirestoreObjectPropsV2>(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
      const data = snapshot.data() as T
      data.Id = snapshot.id

      dateify(data)

      return data
    },
  }
}
