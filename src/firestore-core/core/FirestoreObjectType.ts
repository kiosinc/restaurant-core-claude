import { Attribute } from '../../restaurant/catalog/Attribute';
import Category from '../../restaurant/catalog/Category';
import { CustomizationSet } from '../../restaurant/catalog/CustomizationSet';
import { Product } from '../../restaurant/catalog/Product';
import TaxRate from '../../restaurant/catalog/TaxRate';
import { Business } from '../../restaurant/roots/Business';
import Catalog from '../../restaurant/roots/Catalog';
import ConnectedAccounts from '../../restaurant/roots/ConnectedAccounts';
import Surfaces from '../../restaurant/roots/Surfaces';

/** Firestore objects that are FirestoreObjects */
type FirestoreObjectType = Business | Catalog | Surfaces | ConnectedAccounts
|Attribute | Category | CustomizationSet | Product | TaxRate;

export default FirestoreObjectType;
