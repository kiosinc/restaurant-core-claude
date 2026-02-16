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

export function createMetadataSpec<TEntity extends { Id: string }, TMeta>(
  metaFn: (entity: TEntity) => TMeta,
  linkFn: (entity: TEntity, businessId: string) => MetaLinkDeclaration[],
): MetadataSpec<TEntity, TMeta> {
  return { getMetadata: metaFn, getMetaLinks: linkFn };
}
