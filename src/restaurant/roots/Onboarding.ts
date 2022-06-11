import FirestoreObject from '../../firestore-core/core/FirestoreObject';
import { Business } from './Business';
import * as Config from '../../firestore-core/config';
import Menu from '../surfaces/Menu';
import MenuGroup from '../surfaces/MenuGroup';
import MenuGroupMeta from '../surfaces/MenuGroupMeta';
import Token from '../connected-accounts/Token';
import Category from '../catalog/Category';
import Surfaces from './Surfaces';

const servicesKey = Config.Paths.CollectionNames.onboarding;

export const enum OnboardingStage {
  createBusiness = 'createBusiness',
  squareIntegration = 'squareIntegration',
  categorySync = 'categorySync',
  scheduleMeeting = 'scheduleMeeting',
  configMenu = 'configMenu',
  menuCreate = 'menuCreate',
  onboardingSync = 'onboardingSync',
  shippingInfo = 'shippingInfo',
  kioskPurchase = 'kioskPurchase',
  kioskCheckout = 'kioskCheckout',
  previewKiosk = 'previewKiosk',
  onboardingComplete = 'onboardingComplete',
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
  [OnboardingStage.menuCreate]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingSync]: OnboardingStageStatus.pending,
  [OnboardingStage.shippingInfo]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskCheckout]: OnboardingStageStatus.pending,
  [OnboardingStage.previewKiosk]: OnboardingStageStatus.pending,
  [OnboardingStage.kioskPurchase]: OnboardingStageStatus.pending,
  [OnboardingStage.onboardingComplete]: OnboardingStageStatus.pending,
};

async function repairOnboardingStatus(
  businessId: string,
  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null,
) {
  const onboardingStatusUpdate: { [stage in OnboardingStage]?: OnboardingStageStatus } = {};

  onboardingStatusUpdate[OnboardingStage.categorySync] = onboardingStatus?.categorySync ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.scheduleMeeting] = onboardingStatus?.scheduleMeeting ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.configMenu] = onboardingStatus?.configMenu ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.menuCreate] = onboardingStatus?.menuCreate ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.onboardingSync] = onboardingStatus?.onboardingSync ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.shippingInfo] = onboardingStatus?.shippingInfo ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.kioskCheckout] = onboardingStatus?.kioskCheckout ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.previewKiosk] = onboardingStatus?.previewKiosk ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.kioskPurchase] = onboardingStatus?.kioskPurchase ?? OnboardingStageStatus.complete;
  onboardingStatusUpdate[OnboardingStage.onboardingComplete] = onboardingStatus?.onboardingComplete ?? OnboardingStageStatus.complete;

  onboardingStatusUpdate[OnboardingStage.createBusiness] = OnboardingStageStatus.complete;
  // Check for square token
  const squareTokenSnap = await Token.collectionRef(businessId)
    .doc(Config.Constants.Provider.square).get();
  const squareIntegrationStatus = squareTokenSnap.exists
    ? OnboardingStageStatus.complete
    : OnboardingStageStatus.pending;

  onboardingStatusUpdate[OnboardingStage.squareIntegration] = squareIntegrationStatus;

  return onboardingStatusUpdate;
}

async function createOnboardingMenu(businessId: string, categoryIds: string[]) {
  // Get the categories from the DB
  const categoryPromises = categoryIds.map((id) => Category.collectionRef(businessId).doc(id)
    .withConverter(Category.firestoreConverter).get()
    .then((t) => t.data() as Category));
  // Get

  const categories = await Promise.all(categoryPromises);
  // Create new menu groups / copy categories to menu groups
  // New menu groups

  const newMenuGroups: MenuGroup[] = [];
  // Menu group display order
  const groupDisplayOrder: string[] = [];
  // Menu group meta
  const groups: { [Id: string]: MenuGroupMeta } = {};
  categories.forEach((category) => {
    if (category) {
      const menuGroup = new MenuGroup(
        category.name,
        category.products,
        category.productDisplayOrder,
        category.name,
        '',
        '',
      );
      // Add menu group to be created
      newMenuGroups.push(menuGroup);
      // Save menu group info for menu creation
      groupDisplayOrder.push(menuGroup.Id);
      groups[menuGroup.Id] = menuGroup.metadata();
    } else {
      console.error(`Business: ${businessId} has no categories to migrate`);
    }
  });

  // Setup menu
  const name = `Onboarding Menu ${new Date().toDateString()}`;
  const menu = new Menu(name, name, groups, groupDisplayOrder, null, null, null, null);
  // Save new menu groups to DB
  const menuGroupSet = newMenuGroups.map((mg) => MenuGroup.collectionRef(businessId)
    .withConverter(MenuGroup.firestoreConverter).doc(mg.Id).set(mg));
  await Promise.all(menuGroupSet);

  // Save down menu to db
  await Menu.collectionRef(businessId).withConverter(Menu.firestoreConverter)
    .doc(menu.Id).set(menu);
  console.log(`${businessId} onboarding menu ${menu.Id} created`);

  // TODO-- Delete meta insertion
  const field = `menus.${menu.Id}`;
  const menuGroupMetaData = newMenuGroups.flatMap((group) => [`menuGroups.${group.Id}`, group.metadata()]);
  await Surfaces.docRef(businessId).update(field, menu.metadata(), ...menuGroupMetaData);

  return menu.Id;
}

export class Onboarding extends FirestoreObject<string> {
  stripeCustomerId: string | null;

  onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus };

  onboardingOrderId: string | null;

  menuCategories: string[] | null;

  constructor(
    stripeCustomerId: string | null,
    onboardingStatus: { [stage in OnboardingStage]?: OnboardingStageStatus } | null,
    onboardingOrderId: string | null,
    menuCategories: string[] | null,
    created?: Date,
    updated?: Date,
    isDeleted?: boolean,
    Id?: string,
  ) {
    super(created, updated, isDeleted, Id ?? servicesKey);
    this.stripeCustomerId = stripeCustomerId;
    if (onboardingStatus === null) {
      this.onboardingStatus = defaultOnboardingStatus;
    } else {
      this.onboardingStatus = onboardingStatus;
    }
    this.onboardingOrderId = onboardingOrderId;
    this.menuCategories = menuCategories;
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
        data.stripeCustomerId ?? null, // ?? null for backwards compat
        data.onboardingStatus ?? null,
        data.onboardingOrderId ?? null,
        data.menuCategories ?? null,
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

    if (onboardingSnap.exists) {
      // console.log(`${businessId} Onboarding document exists`);
      const onboarding = onboardingSnap.data() as Onboarding;
      const onboardingStatus = await repairOnboardingStatus(
        businessId,
        onboarding.onboardingStatus ?? null,
      );

      // console.log(`${businessId} Update onboardingStatus ${JSON.stringify(onboardingStatus)}`);
      await onboardingRef.update('onboardingStatus', onboardingStatus);
    } else {
      // console.log(`${businessId} Onboarding document does not exist`);
      const newOnboarding = new Onboarding(null, null, null, null);
      newOnboarding.onboardingStatus = await repairOnboardingStatus(
        businessId,
        null,
      );
      await onboardingRef.set(newOnboarding);
    }
  }

  // Create onboarding menu if the menuConfig stage is complete
  static async createMenu(businessId: string) {
    const onboardingRef = Onboarding.docRef(businessId)
      .withConverter(Onboarding.firestoreConverter);
    const onboarding = await onboardingRef.get()
      .then((t) => t.data() as Onboarding);
    if (!onboarding) {
      throw new Error(`${businessId} onboarding document not found to create onboarding menu`);
    }

    if (onboarding.onboardingStatus.onboardingSync !== OnboardingStageStatus.complete) {
      console.log(`${businessId} onboarding sync not completed-- canceling menu create`);
      return null;
    }
    if (onboarding.onboardingStatus.configMenu !== OnboardingStageStatus.complete) {
      console.log(`${businessId} onboarding menu config not completed-- canceling menu create`);
      return null;
    }
    if (onboarding.onboardingStatus.menuCreate === OnboardingStageStatus.complete) {
      console.log(`${businessId} onboarding menu already created-- canceling this menu create`);
      return null;
    }
    const update = {
      [`onboardingStatus.${OnboardingStage.menuCreate}`]: OnboardingStageStatus.complete,
    };
    await onboardingRef.update(update);
    const categoryIds = onboarding.menuCategories;
    try {
      const menuId = await createOnboardingMenu(businessId, categoryIds ?? []);
      return menuId;
    } catch (e) {
      throw new Error(`${businessId} onboarding menu create error: ${e}`);
    }
  }
}
