import { Attribute } from '../../restaurant/catalog/Attribute';
import Category from '../../restaurant/catalog/Category';
import { CustomizationSet } from '../../restaurant/catalog/CustomizationSet';
import { Product } from '../../restaurant/catalog/Product';
import TaxRate from '../../restaurant/catalog/TaxRate';

/** Firestore objects that are FirestoreObjects */
type LinkedObjectType = Attribute | Category | CustomizationSet | Product | TaxRate;

export default LinkedObjectType;
