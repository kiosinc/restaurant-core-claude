import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { LinkedObjectMap } from '../LinkedObjectRef';

export interface TaxRateProps extends DomainEntityProps {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: LinkedObjectMap;
}

export class TaxRate extends DomainEntity {
  name: string;
  rate: number;
  isCalculatedSubTotalPhase: boolean;
  isInclusive: boolean;
  linkedObjects: LinkedObjectMap;

  constructor(props: TaxRateProps) {
    super(props);
    this.name = props.name;
    this.rate = props.rate;
    this.isCalculatedSubTotalPhase = props.isCalculatedSubTotalPhase;
    this.isInclusive = props.isInclusive;
    this.linkedObjects = props.linkedObjects ?? {};
  }
}
