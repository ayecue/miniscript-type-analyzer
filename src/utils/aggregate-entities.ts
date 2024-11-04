import { IEntity } from '../types/object';

export const aggregateEntity = (source: IEntity): IEntity[] => {
  const entities: IEntity[] = [];
  let isaEntity = source;

  while (isaEntity != null) {
    entities.push(isaEntity);
    isaEntity = isaEntity.getIsa();
  }

  return entities;
};
