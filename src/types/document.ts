import { Container } from 'meta-utils';
import { ASTBaseBlockWithScope, ASTChunk } from 'miniscript-core';

import { IAggregator } from './aggregator';
import { IEntity, IScope } from './object';

export interface DocumentOptions {
  root: ASTChunk;
  container: Container;
  scopeMapping?: WeakMap<ASTBaseBlockWithScope, ScopeContext>;
  globals?: IEntity;
}

export interface ScopeContext {
  aggregator: IAggregator;
  scope: IScope;
}
