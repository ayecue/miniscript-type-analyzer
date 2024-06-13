import { ASTBaseBlockWithScope, ASTChunk } from 'miniscript-core';

import { IAggregator } from './aggregator';
import { EntityFactory, IEntity, IScope } from './object';

export interface DocumentOptions {
  root: ASTChunk;
  factory: EntityFactory;
  scopeMapping?: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  globals?: IEntity;
}

export interface ScopeContext {
  aggregator: IAggregator;
  scope: IScope;
}
