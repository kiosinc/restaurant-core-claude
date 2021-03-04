import { User } from '../../user';
import BusinessProfile from '../misc/BusinessProfile';
import Address from '../misc/Address';
import * as Config from '../../firestore-core/config';
import * as Writer from '../../firestore-core/core/FirestoreWriter';
import { BusinessType, Business } from './Business';

export function createBusiness(user: User.User, type: BusinessType, device: string) {
  const profile: BusinessProfile = new BusinessProfile('', new Address());

  const { uid } = user.token;
  const newBusiness = new Business(device,
    uid,
    type,
    profile,
    { [uid]: Config.Constants.Role.owner });

  return Writer.setObject(newBusiness, Business.firestoreConverter, newBusiness.Id);
}
