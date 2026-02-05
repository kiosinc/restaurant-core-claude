import { DomainEntity, DomainEntityProps } from '../DomainEntity';

export interface CatalogProps extends DomainEntityProps {
  // Catalog is an empty root — only base fields
}

export class Catalog extends DomainEntity {
  constructor(props?: CatalogProps) {
    super(props ?? {});
  }
}
