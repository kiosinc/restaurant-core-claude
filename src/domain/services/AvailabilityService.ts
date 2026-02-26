import { PathResolver } from '../../persistence/firestore/PathResolver';

export interface ProductAvailability {
  isAvailable: boolean;
}

export interface OptionAvailability {
  isAvailable: boolean;
  count: number;
  state: string;
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

export async function setProductAvailabilityBatch(
  businessId: string,
  locationId: string,
  products: { [pid: string]: ProductAvailability },
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const updates: Record<string, ProductAvailability> = {};
  for (const [pid, avail] of Object.entries(products)) {
    updates[`products.${pid}`] = avail;
  }
  await docRef.set(updates, { merge: true });
}

export async function updateAvailability(
  businessId: string,
  locationId: string,
  updates: {
    products?: { [pid: string]: ProductAvailability };
    options?: { [oid: string]: OptionAvailability };
  },
): Promise<void> {
  const docRef = PathResolver.availabilityDoc(businessId, locationId);
  const dotUpdates: Record<string, ProductAvailability | OptionAvailability> = {};
  if (updates.products) {
    for (const [pid, avail] of Object.entries(updates.products)) {
      dotUpdates[`products.${pid}`] = avail;
    }
  }
  if (updates.options) {
    for (const [oid, avail] of Object.entries(updates.options)) {
      dotUpdates[`options.${oid}`] = avail;
    }
  }
  if (Object.keys(dotUpdates).length > 0) {
    await docRef.set(dotUpdates, { merge: true });
  }
}
