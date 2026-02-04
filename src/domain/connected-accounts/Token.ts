import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface TokenProps extends DomainEntityProps {
  createdBy: string;
  businessId: string;
  provider: string;
}

export abstract class Token extends DomainEntity {
  createdBy: string;
  businessId: string;
  provider: string;

  protected constructor(props: TokenProps) {
    super(props);
    this.createdBy = props.createdBy;
    this.businessId = props.businessId;
    this.provider = props.provider;
  }
}
