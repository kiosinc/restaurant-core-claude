import { DomainEntity, DomainEntityProps } from './DomainEntity';

export interface TenantEntityProps extends DomainEntityProps {
  businessId: string;
}

export abstract class TenantEntity extends DomainEntity {
  readonly businessId: string;

  protected constructor(props: TenantEntityProps) {
    super(props);
    this.businessId = props.businessId;
  }
}
