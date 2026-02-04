import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface EventProps extends DomainEntityProps {
  provider: string;
  type: string;
  isSync: boolean;
  queueCap?: number;
  queueCount?: number;
  timestamp?: Date;
}

export class Event extends DomainEntity {
  readonly provider: string;
  readonly type: string;
  isSync: boolean;
  queueCap: number;
  queueCount: number;
  timestamp?: Date;

  constructor(props: EventProps) {
    super({
      ...props,
      Id: props.Id ?? Event.identifier(props.provider, props.type),
    });
    this.provider = props.provider;
    this.type = props.type;
    this.isSync = props.isSync;
    this.queueCap = props.queueCap ?? -1;
    this.queueCount = props.queueCount ?? 0;
    this.timestamp = props.timestamp;
  }

  static identifier(provider: string, type: string): string {
    return `${provider}.${type}`;
  }
}
