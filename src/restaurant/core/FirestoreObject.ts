import { firestoreApp } from "../../firestore-config/firebaseApp";
const FieldValue = require("firebase-admin").firestore.FieldValue;

export abstract class FirestoreObject<C extends Id | void> {
  // Firebase Document ID
  readonly Id: Id;
  readonly created: Date;
  updated: Date;
  protected isDeleted: boolean;

  // Ref to parent collection
  abstract collectionRef(businessId: C): FirebaseFirestore.CollectionReference;
  // <Path: string, Field: string>
  abstract metaLinks(businessId: C): { [p: string]: string };
  abstract metadata(): any;

  abstract readonly converter: FirebaseFirestore.FirestoreDataConverter<unknown>;

  protected constructor(
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: Id
  ) {
    let now = new Date();

    this.created = created ?? now;
    this.updated = updated ?? now;
    this.Id = Id ?? this.autoId();
    this.isDeleted = isDeleted ?? false;
  }

  set(businessId: C): Promise<FirebaseFirestore.DocumentReference> {
    this.updated = new Date();

    const batch = firestoreApp.batch();
    batch.set(
      this.collectionRef(businessId).doc(this.Id).withConverter(this.converter),
      this
    );

    const metaLinks = this.metaLinks(businessId);
    for (const key in metaLinks) {
      const value = metaLinks[key] as string;
      const docRef = firestoreApp.doc(key);
      const fields = { [value]: JSON.parse(JSON.stringify(this.metadata())) };
      batch.update(docRef, fields);
    }

    return batch.commit().then((result) => {
      return this.collectionRef(businessId).doc(this.Id);
    });
  }

  async setTransaction(businessId: C, t: FirebaseFirestore.Transaction) {
    try {
      this.updated = new Date();

      await t.set(
        this.collectionRef(businessId)
          .doc(this.Id)
          .withConverter(this.converter),
        this
      );

      const metaLinks = this.metaLinks(businessId);
      for (const key in metaLinks) {
        const value = metaLinks[key] as string;
        const docRef = firestoreApp.doc(key);
        const fields = { [value]: JSON.parse(JSON.stringify(this.metadata())) };
        await t.update(docRef, fields);
      }
    } catch (error) {
      throw error;
    }
  }

  // delete(businessId: C): Promise<void> {
  //     this.isDeleted = true
  //     this.updated = new Date()
  //
  //     const batch = firestoreApp.batch();
  //     batch.set(this.collectionRef(businessId).doc(this.Id).withConverter(this.converter), this);
  //
  //     this.metaLinks(businessId).forEach((value, key) => {
  //         const docRef = firestoreApp.doc(key)
  //         const fields = { [value]: FieldValue.delete() }
  //         batch.update(docRef, fields);
  //     });
  //
  //     return batch.commit().then()
  // }
  //
  // undelete(businessId: C): Promise<FirebaseFirestore.DocumentReference> {
  //     this.isDeleted = false
  //     this.updated = new Date()
  //
  //     return this.set(businessId)
  // }

  deletePermanent(businessId: C): Promise<void> {
    const batch = firestoreApp.batch();

    batch.delete(this.collectionRef(businessId).doc(this.Id));

    const metaLinks = this.metaLinks(businessId);
    for (const key in metaLinks) {
      const value = metaLinks[key] as string;
      const docRef = firestoreApp.doc(key);
      const fields = { [value]: FieldValue.delete() };
      batch.update(docRef, fields);
    }

    return batch.commit().then();
  }

  async deletePermanentTransaction(
    businessId: C,
    t: FirebaseFirestore.Transaction
  ) {
    try {
      await t.delete(this.collectionRef(businessId).doc(this.Id));

      const metaLinks = this.metaLinks(businessId);
      for (const key in metaLinks) {
        const value = metaLinks[key] as string;
        const docRef = firestoreApp.doc(key);

        const fields = { [value]: FieldValue.delete() };
        await t.update(docRef, fields);
      }
    } catch (error) {
      throw error;
    }
  }

  autoId(): Id {
    return firestoreApp.collection("default").doc().id;
  }
}
