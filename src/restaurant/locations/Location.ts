import { FirestoreObjectV2, FirestoreObjectPropsV2 } from '../../firestore-core'
import Locations from '../roots/Locations'
import { Address } from '../misc/Address'
import LinkedObject from '../../firestore-core/core/LinkedObject'
import * as Paths from '../../firestore-core/Paths'
import { BusinessHours } from '../../utils/schedule'
import { Coordinates } from '../../utils/geo'
import { OrderType } from '../orders/OrderSymbols'
import { Provider } from '../../firestore-core/Constants'

export interface LocationProps {
  name: string
  isActive: boolean
  linkedObjects: { [Id: string]: LinkedObject }
  address: Address
  isPrimary: boolean
  dailyOrderCounter: number
  formattedAddress: string | null
  displayName: string | null
  menuId: string | null
  imageUrls: string[]
  orderTypes: OrderType[] | null
  checkoutOptionsId: string | null
  geoCoordinates: Coordinates | null
  utcOffset: number | null
  businessHours: BusinessHours | null
  phoneNumber: string | null
  email: string | null
}

const ref = (businessId: string) => Locations.docRef(businessId).collection(Paths.CollectionNames.locations)

export class Location extends FirestoreObjectV2 implements LocationProps {
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
      this.metaLinks(businessId, Id)
    )
  }

  static find(businessId: string, linkedObjectId: string, provider: Provider) {
    return FirestoreObjectV2.findGeneric(
      linkedObjectId,
      provider,
      businessId,
      Location.collectionRef(businessId),
      Location
    )
  }

  set() {
    return super.setGeneric(
      ref(this.businessId)
        .doc(this.Id)
        .withConverter(Location.firestoreConverter),
      Location.metaLinks(this.businessId, this.Id),
      this.metadata()
    )
  }

  update() {
    // TODO Update metalinks
    return super.updateGeneric(
      ref(this.businessId)
        .doc(this.Id)
        .withConverter(Location.firestoreConverter)
    )
  }

  static readonly dailyOrderCounterFieldName = 'dailyOrderCounter'

  name: string
  isActive: boolean
  linkedObjects: { [Id: string]: LinkedObject }
  address: Address
  isPrimary: boolean
  dailyOrderCounter: number
  formattedAddress: string | null
  displayName: string | null
  menuId: string | null
  imageUrls: string[]
  orderTypes: OrderType[] | null
  checkoutOptionsId: string | null
  geoCoordinates: Coordinates | null
  utcOffset: number | null
  businessHours: BusinessHours | null
  phoneNumber: string | null
  email: string | null

  constructor (props: LocationProps & FirestoreObjectPropsV2) {
    super(props)

    Object.assign(this, props)

    this.name = props.name
    this.isActive = props.isActive
    this.linkedObjects = props.linkedObjects
    this.address = props.address
    this.formattedAddress = props.formattedAddress ?? null
    this.displayName = props.displayName ?? null
    this.menuId = props.menuId ?? null
    this.imageUrls = props.imageUrls ?? []
    this.orderTypes = props.orderTypes ?? null
    this.checkoutOptionsId = props.checkoutOptionsId ?? null
    this.geoCoordinates = props.geoCoordinates ?? null
    this.utcOffset = props.utcOffset ?? null
    this.businessHours = props.businessHours ?? null
    this.isPrimary = props.isPrimary ?? false
    this.dailyOrderCounter = props.dailyOrderCounter ?? 0
    this.phoneNumber = props.phoneNumber ?? null
    this.email = props.email ?? null
  }

  /** delete */
  // eslint-disable-next-line class-methods-use-this
  static metaLinks(businessId: string, Id: string): { [p: string]: string } {
    return {
      [Locations.docRef(businessId).path]: `${Paths.CollectionNames.locations}.${Id}`,
    };
  }

  metadata(): any {
    return {
      name: this.name,
      isActive: this.isActive,
    };
  }
  /** delete */
}
