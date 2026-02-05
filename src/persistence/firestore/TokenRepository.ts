import { FirestoreRepository, FirestoreRepositoryConfig } from './FirestoreRepository';
import { Token } from '../../domain/connected-accounts/Token';
import { PathResolver } from './PathResolver';

export class TokenRepository extends FirestoreRepository<Token> {
  protected config(): FirestoreRepositoryConfig<Token> {
    return {
      collectionRef(businessId: string) {
        return PathResolver.tokensCollection(businessId);
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
