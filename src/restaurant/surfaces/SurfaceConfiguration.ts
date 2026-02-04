import { FirestoreObject } from '../../firestore-core'
import Surfaces from '../roots/Surfaces'
import * as Paths from '../../firestore-core/Paths'

export interface CoverConfiguration {
  isCoverNoticeEnabled: boolean
  coverNoticeText: string | null;
}

export interface CheckoutFlowConfiguration {

  isCouponsEnabled: boolean;

  isSquareGiftCardEnabled: boolean;

  isOrderNoteEnabled: boolean;

  checkoutCustomerNamePromptText: string | null;

  checkoutCustomerPhoneNumberPromptHeading: string | null;

  checkoutCustomerPhoneNumberPromptText: string | null;

  // Dine-in yes/no
  isDineInEnabled: boolean;

  // Dine-in notice
  isDineInNoticeEnabled: boolean;

  dineInNoticeText: string | null;

  // Dine-in table tent + custom text
  isDineInCustomerEnterIdEnabled: boolean;

  dineInCustomerEnterIdPrompt: string | null;

  // Dine-in ask for name yes/no + custom text
  isDineInCustomerNameRequired: boolean;

  dineInCustomerNameRequiredPrompt: string | null;

  // To-go yes/no
  isToGoEnabled: boolean;

  isToGoNoticeEnabled: boolean;

  // To-go notice
  toGoNoticeText: string | null;

  // Show customer order confirmation text
  orderConfirmationText: string | null;

  isReferralCodeEnabled: boolean

  referralCodePromptText: string | null
}

export interface TipConfiguration {
  // Allow Tips
  isTipsEnabled: boolean;

  // Smart tips on/off
  isSmartTipsEnabled: boolean;
}

const surfaceVersion = '0.0';

/** @deprecated Use Domain.Surfaces.SurfaceConfiguration */
export class SurfaceConfiguration extends FirestoreObject {
  name: string;

  // Charge customers service fee
  isChargeCustomerServiceFee: boolean;

  coverConfiguration: CoverConfiguration | null;

  tipConfiguration: TipConfiguration | null;

  // Checkout
  checkoutFlowConfiguration: CheckoutFlowConfiguration | null;

  version: string;

  constructor(
    name: string,
    isChargeCustomerServiceFee: boolean,
    coverConfiguration: CoverConfiguration | null,
    tipConfiguration: TipConfiguration | null,
    checkoutFlowConfiguration: CheckoutFlowConfiguration | null,
    version?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super({created, updated, isDeleted, Id});

    this.name = name;
    this.isChargeCustomerServiceFee = isChargeCustomerServiceFee;
    this.coverConfiguration = coverConfiguration;
    this.tipConfiguration = tipConfiguration;
    this.checkoutFlowConfiguration = checkoutFlowConfiguration;
    this.version = version ?? surfaceVersion;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string) {
    return SurfaceConfiguration.collectionRef(businessId);
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

  static collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Surfaces.docRef(businessId).collection(Paths.CollectionNames
      .surfaceConfigurations);
  }

  static firestoreConverter = {
    toFirestore(surfaceConfiguration: SurfaceConfiguration): FirebaseFirestore.DocumentData {
      return {
        name: surfaceConfiguration.name,
        isChargeCustomerServiceFee: surfaceConfiguration.isChargeCustomerServiceFee,
        coverConfiguration: surfaceConfiguration.coverConfiguration,
        tipConfiguration: surfaceConfiguration.tipConfiguration,
        checkoutFlowConfiguration: surfaceConfiguration.checkoutFlowConfiguration,
        version: surfaceConfiguration.version,
        created: surfaceConfiguration.created.toISOString(),
        updated: surfaceConfiguration.updated.toISOString(),
        isDeleted: surfaceConfiguration.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): SurfaceConfiguration {
      const data = snapshot.data();

      return new SurfaceConfiguration(
        data.name,
        data.isChargeCustomerServiceFee,
        data.coverConfiguration,
        data.tipConfiguration,
        data.checkoutFlowConfiguration,
        data.version,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
