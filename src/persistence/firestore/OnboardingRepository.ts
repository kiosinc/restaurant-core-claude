import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Onboarding } from '../../domain/roots/Onboarding';
import { PathResolver } from './PathResolver';

export class OnboardingRepository extends FirestoreRepository<Onboarding> {
  protected config(): FirestoreRepositoryConfig<Onboarding> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(ob: Onboarding): FirebaseFirestore.DocumentData {
        return {
          stripeCustomerId: ob.stripeCustomerId,
          onboardingStatus: ob.onboardingStatus,
          onboardingOrderId: ob.onboardingOrderId ?? null,
          menuCategories: ob.menuCategories ?? null,
          created: ob.created.toISOString(),
          updated: ob.updated.toISOString(),
          isDeleted: ob.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Onboarding {
        return new Onboarding({
          Id: id,
          stripeCustomerId: data.stripeCustomerId ?? null,
          onboardingStatus: data.onboardingStatus ?? null,
          onboardingOrderId: data.onboardingOrderId ?? null,
          menuCategories: data.menuCategories ?? null,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
