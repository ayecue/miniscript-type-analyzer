import { ASTBase } from 'miniscript-core';

import { EntityFactory, IEntity, IScope } from './object';

export interface AggregatorOptions {
  scope: IScope;
  factory: EntityFactory;
}

export interface IAggregator {
  resolveType(item: ASTBase, noInvoke: boolean): IEntity;
  resolveNamespace(item: ASTBase): IEntity;
  defineNamespace(item: ASTBase, entity: IEntity): boolean;
}
