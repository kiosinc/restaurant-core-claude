import { PathResolver } from '../../persistence/firestore/PathResolver';

export interface ProductAvailability {
  isAvailable: boolean;
  state?: 'inStock' | 'soldOut';
  timestamp?: string;
}

export interface OptionAvailability {
  isAvailable: boolean;
  count: number;
  state: 'inStock' | 'soldOut';
  timestamp: string;
}

export interface AvailabilityDoc {
  products: { [pid: string]: ProductAvailability };
  options: { [oid: string]: OptionAvailability };
}

export async function getAvailability(businessId: string, locationId: string): Promise<AvailabilityDoc | null> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  return {
    products: data.products ?? {},
    options: data.options ?? {},
  };
}

export async function setProductAvailability(
  businessId: string,
  locationId: string,
  productId: string,
  availability: ProductAvailability,
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  // Nested-object merge-set (not a dotted key, not update()): nests under
  // products.<id> AND upserts, creating the doc when it does not yet exist.
  await docRef.set({ products: { [productId]: availability } }, { merge: true });
}

export async function setOptionAvailability(
  businessId: string,
  locationId: string,
  optionId: string,
  availability: OptionAvailability,
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  // Nested-object merge-set (not a dotted key, not update()): nests under
  // options.<id> AND upserts, creating the doc when it does not yet exist.
  await docRef.set({ options: { [optionId]: availability } }, { merge: true });
}

export async function setProductAvailabilityBatch(
  businessId: string,
  locationId: string,
  products: { [pid: string]: ProductAvailability },
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  await docRef.set({ products }, { merge: true });
}

export async function updateAvailability(
  businessId: string,
  locationId: string,
  updates: {
    products?: { [pid: string]: ProductAvailability };
    options?: { [oid: string]: OptionAvailability };
  },
): Promise<void> {
  const merge: { products?: Record<string, ProductAvailability>; options?: Record<string, OptionAvailability> } = {
    ...(updates.products ? { products: updates.products } : {}),
    ...(updates.options ? { options: updates.options } : {}),
  };
  if (Object.keys(merge).length > 0) {
    const docRef = PathResolver.availabilityDoc(businessId, locationId);
    await docRef.set(merge, { merge: true });
  }
}

export async function getOptionTimestamp(
  businessId: string,
  locationId: string,
  optionId: string,
): Promise<Date | undefined> {
  const doc = await getAvailability(businessId, locationId);
  const ts = doc?.options?.[optionId]?.timestamp;
  return ts ? new Date(ts) : undefined;
}
