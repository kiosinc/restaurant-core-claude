import Address from './Address';

export default class BusinessProfile {
  name: string;

  address?: Address;

  shippingAddress?: Address;

  constructor(
    name: string,
    address?: Address,
    shippingAddress?: Address,
  ) {
    this.name = name;
    this.address = address;
    this.shippingAddress = shippingAddress;
  }

  readonly converter = BusinessProfile.firestoreConverter;

  static firestoreConverter = {
    toFirestore(profile: BusinessProfile): FirebaseFirestore.DocumentData {
      return {
        name: profile.name,
        address: profile.address
          ? Address.firestoreConverter.toFirestore(profile.address)
          : null,
        shippingAddress: profile.shippingAddress
          ? Address.firestoreConverter.toFirestore(profile.shippingAddress)
          : null,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): BusinessProfile {
      const data = snapshot.data();
      return new BusinessProfile(
        data.name,
        data.address
          ? data.address as Address
          : undefined,
        data.shippingAddress
          ? data.shippingAddress as Address
          : undefined,
      );
    },
  };
}
