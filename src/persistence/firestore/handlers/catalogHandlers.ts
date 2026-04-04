import { Product } from '../../../domain/catalog/Product';
import { OptionSet } from '../../../domain/catalog/OptionSet';
import { Option } from '../../../domain/catalog/Option';
import { buildSavedUpdates, buildDeletedUpdates, productSpec, optionSetSpec, optionSpec } from '../../../domain/services/CatalogCascadeService';
import { PathResolver } from '../PathResolver';
import { CascadeRelationshipHandler } from './CascadeRelationshipHandler';
import { CompositeCascadeRelationshipHandler } from './CompositeCascadeRelationshipHandler';

function createProductHandler(
  parentCollectionFn: (bid: string) => FirebaseFirestore.CollectionReference,
): CascadeRelationshipHandler<Product> {
  return new CascadeRelationshipHandler<Product>({
    parentCollection: parentCollectionFn,
    parentQuery: (p) => ['productDisplayOrder', 'array-contains', p.Id],
    onSaved: (entity, parentIds) => buildSavedUpdates(entity, parentIds, productSpec),
    onDeleted: (entity, parentIds) => buildDeletedUpdates(entity, parentIds, productSpec),
  });
}

export const ProductRelationshipHandler = createProductHandler((bid) => PathResolver.categoriesCollection(bid));
export const ProductMenuGroupRelationshipHandler = createProductHandler((bid) => PathResolver.menuGroupsCollection(bid));

// Consumers must register this instead of ProductRelationshipHandler to enable
// Product → MenuGroup cascade. See kiosinc/businesses#212.
export const ProductCompositeHandler = new CompositeCascadeRelationshipHandler<Product>([
  ProductRelationshipHandler,
  ProductMenuGroupRelationshipHandler,
]);

export const OptionSetRelationshipHandler = new CascadeRelationshipHandler<OptionSet>({
  parentCollection: (bid) => PathResolver.productsCollection(bid),
  parentQuery: (os) => [`optionSets.${os.Id}.name`, '>=', ''],
  onSaved: (entity, parentIds) => buildSavedUpdates(entity, parentIds, optionSetSpec),
  onDeleted: (entity, parentIds) => buildDeletedUpdates(entity, parentIds, optionSetSpec),
});

export const OptionRelationshipHandler = new CascadeRelationshipHandler<Option>({
  parentCollection: (bid) => PathResolver.optionSetsCollection(bid),
  parentQuery: (o) => [`options.${o.Id}.name`, '>=', ''],
  onSaved: (entity, parentIds) => buildSavedUpdates(entity, parentIds, optionSpec),
  onDeleted: (entity, parentIds) => buildDeletedUpdates(entity, parentIds, optionSpec),
});
