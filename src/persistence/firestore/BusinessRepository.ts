import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Business } from '../../domain/roots/Business';
import { PathResolver } from './PathResolver';

export class BusinessRepository extends FirestoreRepository<Business> {
  protected config(): FirestoreRepositoryConfig<Business> {
    return {
      collectionRef(_businessId: string) {
        return PathResolver.businessCollection();
      },
      toFirestore(business: Business): FirebaseFirestore.DocumentData {
        return {
          agent: business.agent,
          createdBy: business.createdBy,
          type: business.type,
          businessProfile: {
            name: business.businessProfile.name,
            address: business.businessProfile.address ?? null,
            shippingAddress: business.businessProfile.shippingAddress ?? null,
          },
          roles: JSON.parse(JSON.stringify(business.roles)),
          created: business.created.toISOString(),
          updated: business.updated.toISOString(),
          isDeleted: business.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): Business {
        return new Business({
          Id: id,
          agent: data.agent,
          createdBy: data.createdBy,
          type: data.type,
          businessProfile: {
            name: data.businessProfile?.name ?? '',
            address: data.businessProfile?.address,
            shippingAddress: data.businessProfile?.shippingAddress,
          },
          roles: data.roles ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
