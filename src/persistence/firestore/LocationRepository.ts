import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Location } from '../../domain/locations/Location';
import Locations from '../../restaurant/roots/Locations';
import * as Paths from '../../firestore-core/Paths';

export class LocationRepository extends FirestoreRepository<Location> {
  protected config(): FirestoreRepositoryConfig<Location> {
    return {
      collectionRef(businessId: string) {
        return Locations.docRef(businessId)
          .collection(Paths.CollectionNames.locations);
      },
      toFirestore(location: Location): FirebaseFirestore.DocumentData {
        return {
          name: location.name,
          isActive: location.isActive,
          linkedObjects: JSON.parse(JSON.stringify(location.linkedObjects)),
          address: JSON.parse(JSON.stringify(location.address)),
          isPrimary: location.isPrimary,
          dailyOrderCounter: location.dailyOrderCounter,
          formattedAddress: location.formattedAddress,
          displayName: location.displayName,
          imageUrls: location.imageUrls,
          geoCoordinates: location.geoCoordinates ? JSON.parse(JSON.stringify(location.geoCoordinates)) : null,
          utcOffset: location.utcOffset,
          businessHours: location.businessHours ? JSON.parse(JSON.stringify(location.businessHours)) : null,
          phoneNumber: location.phoneNumber,
          email: location.email,
          currency: location.currency,
          isAcceptsMobileOrders: location.isAcceptsMobileOrders,
          created: location.created.toISOString(),
          updated: location.updated.toISOString(),
          isDeleted: location.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string, businessId: string): Location {
        return new Location({
          Id: id,
          businessId,
          name: data.name,
          isActive: data.isActive,
          linkedObjects: data.linkedObjects ?? {},
          address: data.address,
          isPrimary: data.isPrimary,
          dailyOrderCounter: data.dailyOrderCounter,
          formattedAddress: data.formattedAddress,
          displayName: data.displayName,
          imageUrls: data.imageUrls,
          geoCoordinates: data.geoCoordinates,
          utcOffset: data.utcOffset,
          businessHours: data.businessHours,
          phoneNumber: data.phoneNumber,
          email: data.email,
          currency: data.currency,
          isAcceptsMobileOrders: data.isAcceptsMobileOrders,
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
