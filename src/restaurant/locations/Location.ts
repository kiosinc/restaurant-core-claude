import { FirestoreObject, FirestoreObjectPropsV2 } from '../../firestore-core'
import Locations from '../roots/Locations'
import { Address } from '../misc/Address'
import LinkedObject from '../../firestore-core/core/LinkedObject'
import * as Paths from '../../firestore-core/Paths'
import { BusinessHours } from '../../utils/schedule'
import { Coordinates } from '../../utils/geo'
import { OrderType } from '../orders/OrderSymbols'

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
}

const ref = (businessId: string) => Locations.docRef(businessId).collection(Paths.CollectionNames.locations)

export class Location extends FirestoreObject {
  static firestoreConverter = {
    toFirestore (location: Location): FirebaseFirestore.DocumentData {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { Id, ...data } = location
      return data
    },
    fromFirestore (snapshot: FirebaseFirestore.QueryDocumentSnapshot): Location {
      const data = snapshot.data() as LocationProps & FirestoreObjectPropsV2
      data.Id = snapshot.id
      return new Location(data)
    },
  }

  static collectionRef (businessId: string): FirebaseFirestore.CollectionReference {
    return ref(businessId)
  }

  static get(businessId: string, Id: string) {
    return ref(businessId).doc(Id).withConverter(this.firestoreConverter).get()
  }

  static set(businessId: string, obj: Location) {
    return ref(businessId).doc(obj.Id).withConverter(this.firestoreConverter).set(obj)
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

  constructor (props: LocationProps & FirestoreObjectPropsV2) {
    super(props)

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
  }

  /** delete */
  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return ref(businessId);
  }

  metaLinks(businessId: string): { [p: string]: string } {
    return {
      [Locations.docRef(businessId).path]: `${Paths.CollectionNames.locations}.${this.Id}`,
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
