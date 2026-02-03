/** Optional interface for entities that produce metadata projections */
export interface MetadataProjection<T = Record<string, unknown>> {
  metadata(): T;
}

/** A single denormalization target: which document, which field */
export interface MetaLinkDeclaration {
  documentPath: string;
  fieldPath: string;
}

/** Bridge between domain entity and its metadata denormalization rules */
export interface MetadataSpec<TEntity, TMeta> {
  getMetadata(entity: TEntity): TMeta;
  getMetaLinks(entity: TEntity, businessId: string): MetaLinkDeclaration[];
}
