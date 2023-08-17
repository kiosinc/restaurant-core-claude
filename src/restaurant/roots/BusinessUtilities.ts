import { User } from '../../user/User';
import BusinessProfile from '../misc/BusinessProfile';
import { emptyAddress } from '../misc/Address';
import * as Constants from '../../firestore-core/Constants';
import * as Writer from '../../firestore-core/core/FirestoreWriter';
import { BusinessType, Business } from './Business';

export function createBusiness(user: User, type: BusinessType, device: string, name?: string) {
  const profile: BusinessProfile = new BusinessProfile(name ?? '', emptyAddress);

  const { uid } = user.token;
  const newBusiness = new Business(device,
    uid,
    type,
    profile,
    { [uid]: Constants.Role.owner });

  return Writer.setObject(newBusiness, Business.firestoreConverter, newBusiness.Id);
}
