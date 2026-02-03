import { IdGenerator } from './IdGenerator';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEntityProps {
  Id?: string;
  created?: Date;
  updated?: Date;
  isDeleted?: boolean;
}

export abstract class DomainEntity {
  private static _idGenerator: IdGenerator = { generate: () => uuidv4() };

  static setIdGenerator(generator: IdGenerator): void {
    DomainEntity._idGenerator = generator;
  }

  static getIdGenerator(): IdGenerator {
    return DomainEntity._idGenerator;
  }

  readonly Id: string;
  readonly created: Date;
  updated: Date;
  readonly isDeleted: boolean;

  protected constructor(props: DomainEntityProps) {
    const now = new Date();
    this.Id = props.Id ?? DomainEntity._idGenerator.generate();
    this.created = props.created ?? now;
    this.updated = props.updated ?? now;
    this.isDeleted = props.isDeleted ?? false;
  }
}
