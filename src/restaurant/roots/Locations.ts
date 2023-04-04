import FirestoreObject from '../../firestore-core/core/FirestoreObject'
import { Business } from './Business'
import LocationMeta from '../locations/LocationMeta'
import * as Paths from '../../firestore-core/Paths'

const locationsKey = Paths.CollectionNames.locations;

export default class Locations extends FirestoreObject<string> {
  locations: { [Id: string]: LocationMeta };

  constructor(
    locations: { [p: string]: LocationMeta },

    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? locationsKey);

    this.locations = locations;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.publicCollectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): Record<string, never> {
    return {};
  }

  // STATICS

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.publicCollectionRef(businessId).doc(locationsKey);
  }

  static firestoreConverter = {
    toFirestore(locations: Locations): FirebaseFirestore.DocumentData {
      return {
        locations: JSON.parse(JSON.stringify(locations.locations)),
        created: locations.created.toISOString(),
        updated: locations.updated.toISOString(),
        isDeleted: locations.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Locations {
      const data = snapshot.data();

      return new Locations(
        data.locations,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
