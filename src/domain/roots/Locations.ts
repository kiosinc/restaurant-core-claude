import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface LocationMeta {
  name: string;
  isActive: boolean;
}

export interface LocationsRootProps extends DomainEntityProps {
  locations: { [id: string]: LocationMeta };
}

export class LocationsRoot extends DomainEntity {
  locations: { [id: string]: LocationMeta };

  constructor(props: LocationsRootProps) {
    super(props);
    this.locations = props.locations ?? {};
  }
}
