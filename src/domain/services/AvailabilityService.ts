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
  await docRef.set(
    { [`products.${productId}`]: availability },
    { merge: true },
  );
}

export async function setOptionAvailability(
  businessId: string,
  locationId: string,
  optionId: string,
  availability: OptionAvailability,
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  await docRef.set(
    { [`options.${optionId}`]: availability },
    { merge: true },
  );
}

function prefixKeys(prefix: string, entries: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(entries)) {
    result[`${prefix}.${id}`] = value;
  }
  return result;
}

export async function setProductAvailabilityBatch(
  businessId: string,
  locationId: string,
  products: { [pid: string]: ProductAvailability },
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  await docRef.set(prefixKeys('products', products), { merge: true });
}

export async function updateAvailability(
  businessId: string,
  locationId: string,
  updates: {
    products?: { [pid: string]: ProductAvailability };
    options?: { [oid: string]: OptionAvailability };
  },
): Promise<void> {
  const dotUpdates: Record<string, unknown> = {
    ...(updates.products ? prefixKeys('products', updates.products) : {}),
    ...(updates.options ? prefixKeys('options', updates.options) : {}),
  };
  if (Object.keys(dotUpdates).length > 0) {
    const docRef = PathResolver.availabilityDoc(businessId, locationId);
    await docRef.set(dotUpdates, { merge: true });
  }
}

export async function getOptionTimestamp(
  businessId: string,
  locationId: string,
  optionId: string,
): Promise<Date | undefined> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const snap = await docRef.get();
  if (!snap.exists) return undefined;
  const opt = snap.data()?.options?.[optionId];
  return opt?.timestamp ? new Date(opt.timestamp) : undefined;
}
