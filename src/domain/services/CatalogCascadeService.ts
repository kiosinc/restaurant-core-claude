import { BaseEntity } from '../BaseEntity';
import { productMeta } from '../catalog/Product';
import { optionSetMeta } from '../catalog/OptionSet';
import { optionMeta } from '../catalog/Option';

export interface FieldUpdate {
  fieldsToSet: Record<string, unknown>;
  fieldsToDelete: string[];
  arrayFieldRemovals: Record<string, string>; // field -> value to remove
}

export interface ParentUpdate {
  parentId: string;
  update: FieldUpdate;
}

export interface CascadeSpec {
  mapField: string;
  metaFn: (entity: any) => object;
  /** Additional map fields to delete alongside the main mapField entry (e.g. 'optionSetsSelection') */
  additionalDeleteFields?: string[];
  /** Array fields from which entity.Id should be removed */
  arrayRemovalFields?: string[];
}

export const productSpec: CascadeSpec = {
  mapField: 'products',
  metaFn: productMeta,
  arrayRemovalFields: ['productDisplayOrder'],
};

export const optionSetSpec: CascadeSpec = {
  mapField: 'optionSets',
  metaFn: optionSetMeta,
  additionalDeleteFields: ['optionSetsSelection'],
};

export const optionSpec: CascadeSpec = {
  mapField: 'options',
  metaFn: optionMeta,
  arrayRemovalFields: ['optionDisplayOrder', 'preselectedOptionIds'],
};

export function buildSavedUpdates(entity: BaseEntity, parentIds: string[], spec: CascadeSpec): ParentUpdate[] {
  const meta = spec.metaFn(entity);
  return parentIds.map((parentId) => ({
    parentId,
    update: {
      fieldsToSet: { [`${spec.mapField}.${entity.Id}`]: meta },
      fieldsToDelete: [],
      arrayFieldRemovals: {},
    },
  }));
}

export function buildDeletedUpdates(entity: BaseEntity, parentIds: string[], spec: CascadeSpec): ParentUpdate[] {
  const fieldsToDelete = [
    spec.mapField,
    ...(spec.additionalDeleteFields ?? []),
  ].map((f) => `${f}.${entity.Id}`);
  const arrayFieldRemovals = Object.fromEntries(
    (spec.arrayRemovalFields ?? []).map((f) => [f, entity.Id]),
  );
  return parentIds.map((parentId) => ({
    parentId,
    update: { fieldsToSet: {}, fieldsToDelete, arrayFieldRemovals },
  }));
}
