/**
 * Pure data reference to an object on an external system (e.g. Square POS).
 * Replaces the old LinkedObject class which mixed data with Firestore queries.
 *
 * Usage: `linkedObjects: { [provider: string]: LinkedObjectRef } | null`
 * The key is the provider identifier (e.g. 'square', 'system').
 */
export interface LinkedObjectRef {
  linkedObjectId: string;
}

/**
 * A map of provider keys to their linked object references.
 * Convenience type for the common `linkedObjects` field pattern.
 */
export type LinkedObjectMap = { [provider: string]: LinkedObjectRef };
