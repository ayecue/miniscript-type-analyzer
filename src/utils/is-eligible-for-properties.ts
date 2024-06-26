import { SignatureDefinitionBaseType } from 'meta-utils';

import { IEntity } from '../types/object';

export const isEligibleForProperties = (entity: IEntity) => {
  return (
    entity.types.has(SignatureDefinitionBaseType.Map) ||
    entity.types.has(SignatureDefinitionBaseType.List) ||
    entity.types.has(SignatureDefinitionBaseType.Any)
  );
};
