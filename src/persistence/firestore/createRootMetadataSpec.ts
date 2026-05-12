import { createMetadataSpec, MetadataSpec } from '../../domain/MetadataSpec';

export function createRootMetadataSpec<TEntity extends { Id: string }, TMeta>(
  metaFn: (entity: TEntity) => TMeta,
  rootDocResolver: (businessId: string) => FirebaseFirestore.DocumentReference,
  collectionName: string,
): MetadataSpec<TEntity, TMeta> {
  return createMetadataSpec<TEntity, TMeta>(
    metaFn,
    (entity, businessId) => [{
      documentPath: rootDocResolver(businessId).path,
      fieldPath: `${collectionName}.${entity.Id}`,
    }],
  );
}
