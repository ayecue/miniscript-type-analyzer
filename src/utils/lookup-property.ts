import { IEntity } from '../types/object';
import { isEligibleForProperties } from './is-eligible-for-properties';

export const lookupProperty = (
  entity: IEntity,
  property: string
): IEntity | null => {
  let current = entity;

  while (isEligibleForProperties(current)) {
    const item = current.values.get(`i:${property}`);

    if (item != null) {
      return item;
    }

    const isa = current.values.get('i:__isa');

    if (isa == null) {
      break;
    }

    current = isa;
  }

  return null;
};
