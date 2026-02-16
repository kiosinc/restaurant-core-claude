import { FirestoreRepositoryConfig } from '../FirestoreRepository';
import { Token } from '../../../domain/connected-accounts/Token';
import { PathResolver } from '../PathResolver';
import { baseFieldsToFirestore } from './baseFields';

export const tokenConverter: FirestoreRepositoryConfig<Token> = {
  modelKey: 'token',
  collectionRef(businessId: string) {
    return PathResolver.tokensCollection(businessId);
  },
  toFirestore(token: Token): FirebaseFirestore.DocumentData {
    return {
      createdBy: token.createdBy,
      businessId: token.businessId,
      provider: token.provider,
      ...baseFieldsToFirestore(token),
    };
  },
  fromFirestore(): Token {
    throw new Error('tokenConverter.fromFirestore must be overridden by consumer-specific converter');
  },
};
