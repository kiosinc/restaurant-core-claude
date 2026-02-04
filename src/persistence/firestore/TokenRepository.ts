import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Token } from '../../domain/connected-accounts/Token';
import ConnectedAccounts from '../../restaurant/roots/ConnectedAccounts';
import * as Paths from '../../firestore-core/Paths';

export class TokenRepository extends FirestoreRepository<Token> {
  protected config(): FirestoreRepositoryConfig<Token> {
    return {
      collectionRef(businessId: string) {
        return ConnectedAccounts.docRef(businessId).collection(Paths.CollectionNames.tokens);
      },
      toFirestore(token: Token): FirebaseFirestore.DocumentData {
        return {
          createdBy: token.createdBy,
          businessId: token.businessId,
          provider: token.provider,
          created: token.created.toISOString(),
          updated: token.updated.toISOString(),
          isDeleted: token.isDeleted,
        };
      },
      fromFirestore(): Token {
        throw new Error('TokenRepository.fromFirestore must be overridden by subclass repository');
      },
    };
  }
}
