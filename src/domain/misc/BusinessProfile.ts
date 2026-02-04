import { Address } from './Address';

export interface BusinessProfile {
  name: string;
  address?: Address;
  shippingAddress?: Address;
}
