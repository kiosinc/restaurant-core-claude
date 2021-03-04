export default class Address {
  addressLine1: string;

  addressLine2: string;

  city: string;

  state: string;

  zip: string;

  country: string;

  constructor(
    addressLine1?: string,
    addressLine2?: string,
    city?: string,
    state?: string,
    zip?: string,
    country?: string,
  ) {
    this.addressLine1 = addressLine1 ?? '';
    this.addressLine2 = addressLine2 ?? '';
    this.city = city ?? '';
    this.state = state ?? '';
    this.zip = zip ?? '';
    this.country = country ?? '';
  }

  readonly converter = Address.firestoreConverter;

  static firestoreConverter = {
    toFirestore(profile: Address): FirebaseFirestore.DocumentData {
      return {
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        zip: profile.zip,
        country: profile.country,
      };
    },
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): Address {
      const data = snapshot.data();
      return new Address(
        data.addressLine1,
        data.addressLine2,
        data.city,
        data.state,
        data.zip,
        data.country,
      );
    },
  };
}
