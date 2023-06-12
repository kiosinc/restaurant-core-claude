import * as OrderSymbols from '../orders/OrderSymbols'
import { FirestoreObjectV2, FirestoreObjectPropsV2 } from '../../firestore-core/core/FirestoreObjectV2'
import Surfaces from '../roots/Surfaces'

export interface TipOptions {
  isEnabled: boolean
  isSmartTipEnabled: boolean,
  tipAmounts: number[]
  preselectedIdx: number
}

export interface DiscountOptions {
  isEnabled: boolean
}

export interface GiftCardOptions {
  isEnabled: boolean
}

export interface ReferralCodeOptions {
  isEnabled: boolean
}

export interface ScheduleOptions {
  isEnabled: boolean
}

export interface ContactOptions {
  isEnabled: boolean
}

export interface ManualIdOptions {
  isEnabled: boolean
  config?: ManualIdConfig
}

export interface ManualIdConfig {
  title: string
  text: string
  isQREnabled: boolean
}

export enum CheckoutOptionType {
  switch = 'switch',
  quantity = 'quantity'
}

export interface OptionConfig {
  name: string
  type: CheckoutOptionType
  productId: string
}

// Discount, gift cards, and referral
export interface FulfillmentOption {
  scheduleOptions: ScheduleOptions
  contactOptions: ContactOptions
  manualIdOptions: ManualIdOptions
  options: OptionConfig[]
}

export interface CheckoutOptionsProps extends FirestoreObjectPropsV2{
  name: string
  discounts: DiscountOptions
  giftCards: GiftCardOptions
  referralCodes: ReferralCodeOptions
  tipOptions?: TipOptions
  fulfillmentOptions: { [key in OrderSymbols.OrderType]?: FulfillmentOption }
}

/**
 *
 */
const path = 'CheckoutOptions'
const ref = (businessId: string) => Surfaces.docRef(businessId)
                                            .collection(path)

export class CheckoutOptions extends FirestoreObjectV2 {
  name: string
  discounts: DiscountOptions
  giftCards: GiftCardOptions
  referralCodes: ReferralCodeOptions
  tipOptions?: TipOptions
  fulfillmentOptions: { [key in OrderSymbols.OrderType]?: FulfillmentOption }

  constructor (props: CheckoutOptionsProps & FirestoreObjectPropsV2) {
    super(props)

    this.name = props.name
    this.discounts = props.discounts
    this.giftCards = props.giftCards
    this.referralCodes = props.referralCodes
    this.tipOptions = props.tipOptions
    this.fulfillmentOptions = props.fulfillmentOptions
  }

  set (businessId: string) {
    return ref(businessId)
      .doc(this.Id)
      .withConverter(FirestoreObjectV2.firestoreConverter)
      .set(this)
  }

  async get (businessId: string, Id: string) {
    const request = await ref(businessId)
      .doc(Id)
      .withConverter(FirestoreObjectV2.firestoreConverter)
      .get()

    if (!request.data()) {
      return
    }

    return new CheckoutOptions(request.data())
  }
}
