/**
 * FirestoreObject base class for objects that live on firestore
 */
import { getFirestore } from 'firebase-admin/firestore'

export interface FirestoreObjectProps {
  Id?: string,
  created?: Date,
  updated?: Date,
  isDeleted?: boolean
}

/**
 * FirestoreObject base class for objects that live on firestore
 * Contains base properties each firestore object will write/read
 * onto/from the store i.e. unique ID key
 */
export abstract class FirestoreObject {
  // Firebase Document ID
  readonly Id: string
  readonly created: Date
  updated: Date
  protected isDeleted: boolean

  /**
   * Create FirestoreObject
   * Intended to be called within a subclasses own constructor
   */
  protected constructor (props: FirestoreObjectProps) {
    const now = new Date()

    this.created = props.created ?? now
    this.updated = props.updated ?? now
    this.Id = props.Id ?? FirestoreObject.autoId()
    this.isDeleted = props.isDeleted ?? false
  }

  /**
   * Auto generate an unique ID using Firebase generation
   */
  static autoId (): string {
    return getFirestore().collection('_default').doc().id
  }

  /** DELETE */
  abstract collectionRef (businessId: string): FirebaseFirestore.CollectionReference;
  abstract metaLinks (businessId: string): { [p: string]: string };
  abstract metadata (): any;
  /** DELETE */
}
