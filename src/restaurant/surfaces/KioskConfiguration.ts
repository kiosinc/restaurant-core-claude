import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import * as Config from '../../firestore-core/config';
import Surfaces from '../roots/Surfaces';

const kioskConfigurationVersion = '0.0';

export default class KioskConfiguration extends FirestoreObject<string> {
  name: string;

  unlockCode: string | null;

  surfaceConfigurationId: string | null;

  version: string;

  constructor(
    name: string,
    unlockCode: string | null,
    surfaceConfigurationId: string | null,
    version?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id);

    this.name = name;
    this.unlockCode = unlockCode;
    this.surfaceConfigurationId = surfaceConfigurationId;
    this.version = version ?? kioskConfigurationVersion;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return KioskConfiguration.collectionRef(businessId);
  }

  // eslint-disable-next-line class-methods-use-this
  metaLinks(): { [p: string]: string } {
    return {};
  }

  // eslint-disable-next-line class-methods-use-this
  metadata(): {} {
    return {};
  }

  // STATICS

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    // TODO
    return Surfaces.docRef(businessId).collection(Config.Paths.CollectionNames.kioskConfigurations);
  }

  static firestoreConverter = {
    toFirestore(kioskConfiguration: KioskConfiguration): FirebaseFirestore.DocumentData {
      return {
        name: kioskConfiguration.name,
        unlockCode: kioskConfiguration.unlockCode,
        surfaceConfigurationId: kioskConfiguration.surfaceConfigurationId,
        version: kioskConfiguration.version,
        created: kioskConfiguration.created.toISOString(),
        updated: kioskConfiguration.updated.toISOString(),
        isDeleted: kioskConfiguration.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): KioskConfiguration {
      const data = snapshot.data();

      return new KioskConfiguration(
        data.name,
        data.unlockCode,
        data.surfaceConfigurationId,
        data.version,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
