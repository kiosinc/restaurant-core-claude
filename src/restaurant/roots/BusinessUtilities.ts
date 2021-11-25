import { User } from '../../user/User';
import BusinessProfile from '../misc/BusinessProfile';
import Address from '../misc/Address';
import * as Config from '../../firestore-core/config';
import * as Writer from '../../firestore-core/core/FirestoreWriter';
import { BusinessType, Business } from './Business';

// eslint-disable-next-line import/prefer-default-export
export function createBusiness(user: User, type: BusinessType, device: string, name?: string) {
  const profile: BusinessProfile = new BusinessProfile(name ?? '', new Address());

  const { uid } = user.token;
  const newBusiness = new Business(device,
    uid,
    type,
    profile,
    { [uid]: Config.Constants.Role.owner });

  return Writer.setObject(newBusiness, Business.firestoreConverter, newBusiness.Id);
}
