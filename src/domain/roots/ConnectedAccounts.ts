import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface ConnectedAccountsProps extends DomainEntityProps {
  tokens: { [provider: string]: { [key: string]: string } };
}

export class ConnectedAccounts extends DomainEntity {
  tokens: { [provider: string]: { [key: string]: string } };

  constructor(props: ConnectedAccountsProps) {
    super(props);
    this.tokens = props.tokens ?? {};
  }
}
