import {
  FirestoreObjectV2,
  FirestoreObjectPropsV2,
} from '../../firestore-core/core/FirestoreObjectV2'
import Surfaces from '../roots/Surfaces'

export interface KioskOptionProps extends FirestoreObjectPropsV2 {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version: string;
}

const kioskConfigurationVersion = '1.0'
const path = 'kioskConfigurations'
const ref = (businessId: string) => Surfaces.docRef(businessId).collection(path)

export default class KioskConfiguration extends FirestoreObjectV2 implements KioskOptionProps {

  name: string
  unlockCode: string | null
  checkoutOptionId: string | null
  version: string

  constructor (props: KioskOptionProps) {
    super(props)

    this.name = props.name
    this.unlockCode = props.unlockCode
    this.checkoutOptionId = props.checkoutOptionId
    this.version = props.version ?? kioskConfigurationVersion
  }

  async set () {
    const doc = ref(this.businessId)
      .doc(this.Id)

    return super.setGeneric(doc)
  }

  async update () {
    const doc = ref(this.businessId)
      .doc(this.Id)
    return super.updateGeneric(doc)
  }

  static async get (businessId: string, Id: string) {
    const doc = ref(businessId).doc(Id)

    return super.getGeneric(businessId, doc, KioskConfiguration)
  }
}
