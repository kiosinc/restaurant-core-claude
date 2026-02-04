import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface KioskConfigurationProps extends DomainEntityProps {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version?: string;
}

export class KioskConfiguration extends DomainEntity {
  name: string;
  unlockCode: string | null;
  checkoutOptionId: string | null;
  version: string;

  constructor(props: KioskConfigurationProps) {
    super(props);
    this.name = props.name;
    this.unlockCode = props.unlockCode ?? null;
    this.checkoutOptionId = props.checkoutOptionId ?? null;
    this.version = props.version ?? '1.0';
  }
}
