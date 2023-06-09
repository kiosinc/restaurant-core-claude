/** LinkedObject type */

import Category from '../../restaurant/catalog/Category';
import { Product } from '../../restaurant/catalog/Product';
import TaxRate from '../../restaurant/catalog/TaxRate';
import { Discount } from '../../restaurant/catalog/Discount';
import { Location } from '../../restaurant/locations/Location';
import OptionSet from '../../restaurant/catalog/OptionSet';
import Option from '../../restaurant/catalog/Option';

/** Objects that are linked/related to objects on an external system */
type LinkedObjectType = Category
| Product
| TaxRate
| Discount
| Location
| OptionSet
| Option;

export default LinkedObjectType;
