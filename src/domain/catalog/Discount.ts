import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum DiscountType {
  percentage = 'percentage',
  amount = 'amount',
  unknown = 'unknown',
}

export interface DiscountProps extends DomainEntityProps {
  name: string;
  description: string;
  couponCode: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class Discount extends DomainEntity {
  name: string;
  description: string;
  couponCode: string;
  type: DiscountType;
  value: number;
  isActive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: DiscountProps) {
    super(props);
    this.name = props.name;
    this.description = props.description ?? '';
    this.couponCode = props.couponCode ?? '';
    this.type = props.type;
    this.value = props.value;
    this.isActive = props.isActive;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
