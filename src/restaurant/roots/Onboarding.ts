import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';

const servicesKey = Config.Paths.CollectionNames.onboarding;

export const enum OnboardingStage {
  createBusiness = 'createBusiness',
  squareIntegration = 'squareIntegration',
  categorySync = 'categorySync',
  scheduleMeeting = 'scheduleMeeting',
  configMenu = 'configMenu',
  shippingInfo = 'shippingInfo',
  kioskPurchase = 'kioskPurchase',
  kioskCheckout = 'kioskCheckout',
  previewKiosk = 'previewKiosk',
}

export const enum OnboardingStageStatus {
  pending = 'pending',
  complete = 'complete',
  skipped = 'skipped',
}

export class Onboarding extends FirestoreObject<string> {
  stripeCustomerId: string;

  menuCategories: { [Id: string]: number };

  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };

  onboardingOrderId?: string;

  constructor(
    stripeCustomerId: string,
    menuCategories: { [Id: string]: number },
    onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus },
    onboardingOrderId?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? servicesKey);
    this.stripeCustomerId = stripeCustomerId;
    this.menuCategories = menuCategories;
    this.onboardingStatus = onboardingStatus;
    this.onboardingOrderId = onboardingOrderId;
  }

  // eslint-disable-next-line class-methods-use-this
  collectionRef(businessId: string): FirebaseFirestore.CollectionReference {
    return Business.privateCollectionRef(businessId);
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

  static docRef(businessId: string) : FirebaseFirestore.DocumentReference {
    return Business.privateCollectionRef(businessId).doc(servicesKey);
  }

  static firestoreConverter = {
    toFirestore(onboarding: Onboarding): FirebaseFirestore.DocumentData {
      return {
        stripeCustomerId: onboarding.stripeCustomerId,
        menuCategories: onboarding.menuCategories,
        onboardingStatus: onboarding.onboardingStatus,
        onboardingOrderId: onboarding.onboardingOrderId ?? null,
        created: onboarding.created.toISOString(),
        updated: onboarding.updated.toISOString(),
        isDeleted: onboarding.isDeleted,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Onboarding {
      const data = snapshot.data();

      return new Onboarding(
        data.stripeCustomerId,
        data.menuCategories,
        data.onboardingStatus,
        data.onboardingOrderId === null ? undefined : data.onboardingOrderId,
        new Date(data.created),
        new Date(data.updated),
        data.isDeleted,
        snapshot.id,
      );
    },
  };
}
