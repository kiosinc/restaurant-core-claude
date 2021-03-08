/** LinkedObject type */

import { Attribute } from '../../restaurant/catalog/Attribute';
import Category from '../../restaurant/catalog/Category';
import { CustomizationSet } from '../../restaurant/catalog/CustomizationSet';
import { Product } from '../../restaurant/catalog/Product';
import TaxRate from '../../restaurant/catalog/TaxRate';
import { Discount } from '../../restaurant/catalog/Discount';

/** Objects that are linked/related to objects on an external system */
type LinkedObjectType = Attribute | Category | CustomizationSet | Product | TaxRate | Discount;

export default LinkedObjectType;
