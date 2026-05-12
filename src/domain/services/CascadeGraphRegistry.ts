export type CascadeTier = 'field' | 'rebuild';

export interface CascadeEdge {
  target: string;
  tier: CascadeTier;
}

export interface CascadeNode {
  entityType: string;
  parents: CascadeEdge[];
}

export class CascadeGraphRegistry {
  private nodes = new Map<string, CascadeNode>();

  register(node: CascadeNode): void {
    this.nodes.set(node.entityType, node);
  }

  resolve(entityType: string): CascadeNode | undefined {
    return this.nodes.get(entityType);
  }

  getAncestors(entityType: string, tier?: CascadeTier): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    this.walkAncestors(entityType, tier, visited, result);
    return result;
  }

  affectsMenus(entityType: string): boolean {
    const ancestors = this.getAncestors(entityType);
    return ancestors.includes('menu') || entityType === 'menu';
  }

  clear(): void {
    this.nodes.clear();
  }

  get size(): number {
    return this.nodes.size;
  }

  private walkAncestors(
    entityType: string,
    tier: CascadeTier | undefined,
    visited: Set<string>,
    result: string[],
  ): void {
    if (visited.has(entityType)) return;
    visited.add(entityType);

    const node = this.nodes.get(entityType);
    if (!node) return;

    for (const edge of node.parents) {
      if (tier && edge.tier !== tier) continue;
      if (!result.includes(edge.target)) {
        result.push(edge.target);
      }
      this.walkAncestors(edge.target, tier, visited, result);
    }
  }
}

export function createDefaultCascadeGraph(): CascadeGraphRegistry {
  const registry = new CascadeGraphRegistry();

  registry.register({ entityType: 'option', parents: [{ target: 'optionSet', tier: 'field' }] });
  registry.register({ entityType: 'optionSet', parents: [{ target: 'product', tier: 'field' }] });
  registry.register({
    entityType: 'product',
    parents: [
      { target: 'category', tier: 'field' },
      { target: 'menuGroup', tier: 'field' },
    ],
  });
  registry.register({ entityType: 'category', parents: [] });
  registry.register({ entityType: 'menuGroup', parents: [{ target: 'menu', tier: 'rebuild' }] });
  registry.register({ entityType: 'collection', parents: [{ target: 'menu', tier: 'rebuild' }] });
  registry.register({ entityType: 'menu', parents: [] });

  return registry;
}
