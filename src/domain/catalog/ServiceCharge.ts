import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export enum ServiceChargeType {
  percentage = 'percentage',
  amount = 'amount',
}

export interface ServiceChargeProps extends DomainEntityProps {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects: LinkedObjectMap;
}

export class ServiceCharge extends DomainEntity {
  name: string;
  value: number;
  type: ServiceChargeType;
  isCalculatedSubTotalPhase: boolean;
  isTaxable: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: ServiceChargeProps) {
    super(props);
    this.name = props.name;
    this.value = props.value;
    this.type = props.type;
    this.isCalculatedSubTotalPhase = props.isCalculatedSubTotalPhase;
    this.isTaxable = props.isTaxable;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
