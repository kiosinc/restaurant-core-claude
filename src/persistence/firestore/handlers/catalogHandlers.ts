import { Product } from '../../../domain/catalog/Product';
import { OptionSet } from '../../../domain/catalog/OptionSet';
import { Option } from '../../../domain/catalog/Option';
import { buildSavedUpdates, buildDeletedUpdates, productSpec, optionSetSpec, optionSpec } from '../../../domain/services/CatalogCascadeService';
import { PathResolver } from '../PathResolver';
import { CascadeRelationshipHandler } from './CascadeRelationshipHandler';

export const ProductRelationshipHandler = new CascadeRelationshipHandler<Product>({
  parentCollection: (bid) => PathResolver.categoriesCollection(bid),
  parentQuery: (p) => ['productDisplayOrder', 'array-contains', p.Id],
  onSaved: (entity, parentIds) => buildSavedUpdates(entity, parentIds, productSpec),
  onDeleted: (entity, parentIds) => buildDeletedUpdates(entity, parentIds, productSpec),
});

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
