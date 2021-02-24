import {Address} from "./Address";

export class BusinessProfile {
    name: string
    address: Address

    constructor(
        name: string,
        address: Address,
    ) {
        this.name = name;
        this.address = address;
    }

    readonly converter = BusinessProfile.firestoreConverter;

    static firestoreConverter = {
        toFirestore(profile: BusinessProfile): FirebaseFirestore.DocumentData {
            return {
                name: profile.name,
                address: Address.firestoreConverter.toFirestore(profile.address)
            }
        },
        fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): BusinessProfile {
            const data = snapshot.data();
            return new BusinessProfile(
                data.name,
                data.address as Address
            )
        }
    }
}

