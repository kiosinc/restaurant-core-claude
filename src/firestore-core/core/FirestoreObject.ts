/**
 * FirestoreObject base class for objects that live on firestore
 */
import { firestoreApp } from '../firebaseApp';

/**
 * FirestoreObject base class for objects that live on firestore
 * Contains base properties each firestore object will write/read
 * onto/from the store i.e. unique ID key
 */
export default abstract class FirestoreObject<C extends string | void> {
  // Firebase Document ID
  readonly Id: string;

  readonly created: Date;

  // TODO   readonly updated: Date;
  updated: Date;

  protected isDeleted: boolean;

  /**
   * CollectionReference to the database object for the given business
   */
  abstract collectionRef(businessId: C): FirebaseFirestore.CollectionReference;

  /**
   * The static paths where this database object's meta
   * is written to, in the shape of {Path: string, Field: string}
   */
  abstract metaLinks(businessId: C): { [p: string]: string };

  /**
   * The metadata that is written to each meta link
   */
  abstract metadata(): any;

  /**
   * Create FirestoreObject
   * Intended to be called within a subclasses own constructor
   */
  protected constructor(
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    const now = new Date();

    this.created = created ?? now;
    this.updated = updated ?? now;
    this.Id = Id ?? FirestoreObject.autoId();
    this.isDeleted = isDeleted ?? false;
  }

  /**
   * Auto generate an unique ID using Firebase generation
   */
  static autoId(): string {
    return firestoreApp.collection('default').doc().id;
  }
}
