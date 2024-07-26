import { FirestoreObjectV2, FirestoreObjectPropsV2 } from '../../firestore-core'
import { Business } from './Business'

export declare const enum FeatureListKeys {
  remy_configurationProfile = 'remy-configurationProfile',
  remy_kiosk_softwareUpdate = 'remy-kiosk-softwareUpdate'
}

export const DEFAULT_FEATURELIST: FeatureListProps = {
  locationId: null,
  enabled: {
    [FeatureListKeys.remy_configurationProfile]: false,
    [FeatureListKeys.remy_kiosk_softwareUpdate]: false,
  }
}

export interface FeatureListProps {
  locationId: string |null
  enabled: { [key in FeatureListKeys]: boolean}
}

const ref = (businessId: string) => Business.featurelistRef(businessId)

export class FeatureList extends FirestoreObjectV2 implements FeatureListProps {
  // TODO try to remove this line
  static firestoreConverter = super.firestoreConverter

  static collectionRef (businessId: string): FirebaseFirestore.CollectionReference {
    return ref(businessId)
  }

  static get(businessId: string, Id: string) {
    return super.getGeneric(businessId,
                            ref(businessId)
                              .doc(Id)
                              .withConverter(this.firestoreConverter),
                            this,
    )
  }

  static delete(businessId: string, Id: string) {
    return super.deleteGeneric(
      ref(businessId).doc(Id),
      {}
    )
  }

  static async find(businessId: string, locationId: string | null) {
    const query = this.collectionRef(businessId)
                      .where('locationId', '==', locationId)
      .withConverter(this.firestoreConverter)
    const result = await query.get()

    const docs = result.docs
    if (docs.length > 0) {
      const featurelist = docs[0]

      return featurelist
    } else return null
  }

  set() {
    return super.setGeneric(
      ref(this.businessId)
        .doc(this.Id)
        .withConverter(FeatureList.firestoreConverter),
      {},
      null
    )
  }

  update() {
    return super.updateGeneric(
      ref(this.businessId)
        .doc(this.Id)
        .withConverter(FeatureList.firestoreConverter)
    )
  }

  locationId: string |null
  enabled: { [key in FeatureListKeys]: boolean}

  constructor (props: FeatureListProps & FirestoreObjectPropsV2) {
    super(props)

    Object.assign(this, props)

    this.locationId = props.locationId
    this.enabled = props.enabled
  }
  /** delete */
}
