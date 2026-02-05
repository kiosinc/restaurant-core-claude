import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { ConnectedAccounts } from '../../domain/roots/ConnectedAccounts';
import { PathResolver } from './PathResolver';

export class ConnectedAccountsRootRepository extends FirestoreRepository<ConnectedAccounts> {
  protected config(): FirestoreRepositoryConfig<ConnectedAccounts> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.privateCollection(businessId);
      },
      toFirestore(ca: ConnectedAccounts): FirebaseFirestore.DocumentData {
        return {
          tokens: JSON.parse(JSON.stringify(ca.tokens)),
          created: ca.created.toISOString(),
          updated: ca.updated.toISOString(),
          isDeleted: ca.isDeleted,
        };
      },
      fromFirestore(data: FirebaseFirestore.DocumentData, id: string): ConnectedAccounts {
        return new ConnectedAccounts({
          Id: id,
          tokens: data.tokens ?? {},
          created: new Date(data.created),
          updated: new Date(data.updated),
          isDeleted: data.isDeleted,
        });
      },
    };
  }
}
