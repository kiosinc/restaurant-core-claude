import { FieldValue } from 'firebase-admin/firestore';
import { RelationshipHandler } from './RelationshipHandler';
import { Product } from '../../../domain/catalog/Product';
import { PathResolver } from '../PathResolver';

/**
 * When a Product is saved: update ProductMeta in all Categories that contain it.
 * When a Product is deleted: remove from Category products map and productDisplayOrder.
 */
export class ProductRelationshipHandler implements RelationshipHandler<Product> {
  async onSet(product: Product, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const categoryRef = PathResolver.categoriesCollection(businessId);
    const snapshot = await t.get(
      categoryRef.where('productDisplayOrder', 'array-contains', product.Id),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, { [`products.${product.Id}`]: product.metadata() });
    }
  }

  async onDelete(product: Product, businessId: string, t: FirebaseFirestore.Transaction): Promise<void> {
    const categoryRef = PathResolver.categoriesCollection(businessId);
    const snapshot = await t.get(
      categoryRef.where('productDisplayOrder', 'array-contains', product.Id),
    );
    for (const doc of snapshot.docs) {
      t.update(doc.ref, {
        [`products.${product.Id}`]: FieldValue.delete(),
        productDisplayOrder: FieldValue.arrayRemove(product.Id),
      });
    }
  }
}
