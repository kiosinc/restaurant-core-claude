import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import Token from '../connected-accounts/Token';

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

const defaultOnboardingStatus: { [stage in OnboardingStage]: OnboardingStageStatus } = {
  [OnboardingStage.createBusiness]: OnboardingStageStatus.pending,
  [OnboardingStage.squareIntegration]: OnboardingStageStatus.pending,
  [OnboardingStage.categorySync]: OnboardingStageStatus.pending,
  [OnboardingStage.scheduleMeeting]: OnboardingStageStatus.pending,
  [OnboardingStage.configMenu]: OnboardingStageStatus.pending,
  [OnboardingStage.shippingInfo]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskCheckout]: OnboardingStageStatus.pending,
  [OnboardingStage.previewKiosk]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskPurchase]: OnboardingStageStatus.pending,
};

export class Onboarding extends FirestoreObject<string> {
  stripeCustomerId: string;

  menuCategories: { [Id: string]: number };

  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };

  onboardingOrderId?: string;

  constructor(
    stripeCustomerId: string,
    menuCategories: { [Id: string]: number },
    onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null,
    onboardingOrderId?: string,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? servicesKey);
    this.stripeCustomerId = stripeCustomerId;
    this.menuCategories = menuCategories;
    if (onboardingStatus === null) {
      this.onboardingStatus = defaultOnboardingStatus;
    } else {
      this.onboardingStatus = onboardingStatus;
    }
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

  static async repair(businessId: string) {
    const onboardingRef = Onboarding.docRef(businessId)
      .withConverter(Onboarding.firestoreConverter);
    const onboardingSnap = await onboardingRef.get();

    console.log(`${businessId} Onboarding document exists`);
    if (onboardingSnap.exists) {
      const onboarding = onboardingSnap.data() as Onboarding;
      const { onboardingStatus } = onboarding;

      console.log(`${businessId} Onboarding stage status already exists ${!Object.is(onboardingStatus, undefined)}`);
      const onboardingStatusUpdate: { [stage in OnboardingStage]?: OnboardingStageStatus } = defaultOnboardingStatus;

      onboardingStatusUpdate[OnboardingStage.createBusiness] = onboardingStatus?.createBusiness ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.squareIntegration] = onboardingStatus?.squareIntegration ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.categorySync] = onboardingStatus?.categorySync ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.scheduleMeeting] = onboardingStatus?.scheduleMeeting ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.configMenu] = onboardingStatus?.configMenu ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.shippingInfo] = onboardingStatus?.shippingInfo ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.kioskCheckout] = onboardingStatus?.kioskCheckout ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.previewKiosk] = onboardingStatus?.previewKiosk ?? OnboardingStageStatus.complete;
      onboardingStatusUpdate[OnboardingStage.kioskPurchase] = onboardingStatus?.kioskPurchase ?? OnboardingStageStatus.complete;

      if (!onboardingStatus?.createBusiness) {
        onboardingStatusUpdate[OnboardingStage.createBusiness] = OnboardingStageStatus.complete;
        console.log(
          `${businessId} update createBusiness ${JSON.stringify(onboardingStatusUpdate[OnboardingStage.createBusiness])}`,
        );
      }

      if (!onboardingStatus?.squareIntegration) {
        // Check for square token
        const squareTokenSnap = await Token.collectionRef(businessId)
          .doc(Config.Constants.Provider.square).get();
        const squareIntegrationStatus = squareTokenSnap.exists
          ? OnboardingStageStatus.complete
          : OnboardingStageStatus.pending;

        onboardingStatusUpdate[OnboardingStage.squareIntegration] = squareIntegrationStatus;
        console.log(
          `${businessId} update squareIntegration ${JSON.stringify(squareIntegrationStatus)}`,
        );
      }

      console.log(`${businessId} Update onboardingStatus ${JSON.stringify(onboardingStatusUpdate)}`);
      await onboardingRef.update('onboardingStatus', onboardingStatusUpdate);
    } else {
      throw new Error(`${businessId} Onboarding document does not exist`);
    }
  }
}
