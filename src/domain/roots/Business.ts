import { DomainEntity, DomainEntityProps } from '../DomainEntity';
import { BusinessProfile } from '../misc/BusinessProfile';

export enum BusinessType {
  restaurant = 'restaurant',
}

export enum Role {
  sysadmin = 'sysadmin',
  owner = 'owner',
}

export interface BusinessProps extends DomainEntityProps {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };
}

export class Business extends DomainEntity {
  agent: string;
  createdBy: string;
  type: BusinessType;
  businessProfile: BusinessProfile;
  roles: { [uid: string]: Role };

  constructor(props: BusinessProps) {
    super(props);
    this.agent = props.agent;
    this.createdBy = props.createdBy;
    this.type = props.type;
    this.businessProfile = props.businessProfile;
    this.roles = props.roles ?? {};
  }
}
