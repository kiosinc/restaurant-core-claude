import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface ServicesProps extends DomainEntityProps {
  kioskFeeRate: number;
  experiments: { [key: string]: boolean };
}

export class Services extends DomainEntity {
  kioskFeeRate: number;
  experiments: { [key: string]: boolean };

  constructor(props: ServicesProps) {
    super(props);
    this.kioskFeeRate = props.kioskFeeRate ?? 1.5;
    this.experiments = props.experiments ?? {};
  }
}
