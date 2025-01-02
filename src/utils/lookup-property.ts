import { IEntity, PropertyType } from '../types/object';
import { isEligibleForProperties } from './is-eligible-for-properties';

export const lookupProperty = (
  type: PropertyType,
  entity: IEntity,
  property: string
): IEntity | null => {
  let current = entity;
  const visited = new Set<IEntity>([current]);

  while (isEligibleForProperties(current)) {
    const item = current.values.get(`${type}:${property}`);

    if (item != null) {
      return item;
    }

    const isa = current.getIsa();

    if (isa == null || visited.has(isa)) {
      break;
    }

    visited.add(isa);
    current = isa;
  }

  return null;
};
