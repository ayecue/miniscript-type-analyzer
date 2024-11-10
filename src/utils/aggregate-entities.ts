import { IEntity } from '../types/object';

export const aggregateEntity = (source: IEntity): IEntity[] => {
  const entities: Set<IEntity> = new Set();
  let isaEntity = source;

  while (isaEntity != null && !entities.has(isaEntity)) {
    entities.add(isaEntity);
    isaEntity = isaEntity.getIsa();
  }

  return Array.from(entities);
};
